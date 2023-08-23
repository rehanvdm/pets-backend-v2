import * as path from 'path';
import * as fse from 'fs-extra';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as esbuild from 'esbuild';
import execa from 'execa';
import { API_PACKAGE, ENVIRONMENT, TEST_VARIABLES } from '@config/index';
import { apiGwContext, ApiGwEventOptions, apiGwEventV2, setEnvVariables } from '@tests/helpers';
import { envToObject } from '@backend/lambda/api/environment';
import express, { Request, Response } from 'express';
import * as bodyParser from 'body-parser';
import cors from 'cors';
import { handler } from '@backend/lambda/api';
import console from 'console';
import { killPortProcess } from 'kill-port-process';
import { generateOpenApiDocument } from 'trpc-openapi';
import { appRouter } from '@backend/lambda/api/server';
import * as yaml from 'js-yaml';
import { generateApi } from 'swagger-typescript-api';
import semver from 'semver';

const baseDir = '../';
const paths = {
  workingDir: path.resolve(__dirname, baseDir),
  src: path.resolve(__dirname, baseDir, 'src'),
  srcBackend: path.resolve(__dirname, baseDir, 'src', 'backend'),
  dist: path.resolve(__dirname, baseDir, 'dist'),
  distBackend: path.resolve(__dirname, baseDir, 'dist', 'backend'),
  apiPackage: path.resolve(__dirname, baseDir, 'api-package'),
};

async function runCommand(
  command: string,
  args: string[] | string,
  options: execa.Options<string> = {},
  echoCommand: boolean = true,
  exitProcessOnError: boolean = true
) {
  if (!Array.isArray(args)) args = args.split(' ');

  if (echoCommand) console.log('> Running:', command, args.join(' '));

  const resp = await execa(command, args, { ...options, preferLocal: true, reject: false });

  if (resp.exitCode !== 0) {
    if (exitProcessOnError) {
      console.error(resp.stderr || resp.stdout);
      process.exit(1);
    } else throw new Error(resp.stderr || resp.stdout);
  }

  console.log(resp.stdout);
}

const commands = [
  'cdk-diff',
  'cdk-deploy',
  'cdk-hotswap',
  'validate-src',
  'build-src',
  'start-local-api',
  'build-api-package',
  'publish-api-package',
] as const;
export type Command = (typeof commands)[number];

const argv = yargs(hideBin(process.argv))
  .option('command', {
    alias: 'c',
    describe: 'the command you want to run',
    choices: commands,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .demandOption(['c']).argv as any;

(async () => {
  const command = argv.c as Command;
  switch (command) {
    case 'cdk-diff':
      await cdkCommand('diff');
      break;
    case 'cdk-deploy':
      await cdkCommand('deploy');
      break;
    case 'cdk-hotswap':
      await cdkCommand('hotswap');
      break;
    case 'validate-src':
      await validateSrc();
      break;
    case 'build-src':
      await buildTsLambdas();
      break;
    case 'start-local-api':
      const port = 3000;
      await killPortProcess(port);
      await new Promise((resolve) => setTimeout(resolve, 100)); // wait for port to be released
      await startLocalApi(port);
      break;
    case 'build-api-package':
      await buildApiPackage();
      break;
    case 'publish-api-package':
      await publishApiPackage();
      break;
    default:
      throw new Error('Unknown command: ' + command);
  }
})();

async function cdkCommand(command: 'diff' | 'deploy' | 'hotswap') {
  let extraArgs = '';
  if (command === 'deploy' || command === 'hotswap') extraArgs = '--require-approval never';
  if (command === 'hotswap') {
    command = 'deploy';
    extraArgs += ' --hotswap';
  }

  await runCommand('cdk', `${command} "**" --profile ${ENVIRONMENT.profile} ${extraArgs}`, {
    cwd: paths.workingDir,
    stdout: 'inherit',
    stderr: 'inherit',
  });
}

async function validateSrc() {
  await runCommand('tsc', ['--noEmit'], { cwd: paths.workingDir });
  await runCommand('eslint', ['**/*.ts', '--ignore-pattern', "'**/*.d.ts'", '--fix'], { cwd: paths.workingDir });
}

async function buildTsLambdas() {
  console.log('BUILDING TS LAMBDAS');

  const tsLambdaDirectories = ['lambda/api'];

  for (const lambdaDir of tsLambdaDirectories) {
    const fullLambdaDir = path.join(paths.srcBackend, lambdaDir);
    const pathTs = path.join(fullLambdaDir, 'index.ts');
    const pathJs = path.join(paths.distBackend, lambdaDir, 'index.js');

    await esbuild.build({
      platform: 'node',
      target: ['esnext'],
      minify: true,
      bundle: true,
      keepNames: true,
      sourcemap: 'linked',
      sourcesContent: false,
      entryPoints: [pathTs],
      outfile: pathJs,
      external: [''],
      logLevel: 'warning',
      metafile: true,
    });
  }

  console.log('LAMBDAS TS BUILD');
}

async function startLocalApi(port: number) {
  console.log('STARTING..');

  /* Set ENV variables */
  setEnvVariables(envToObject(TEST_VARIABLES.env.api));

  const app = express();
  app.use(bodyParser.json());
  app.use(cors());

  app.use('/', async (req: Request, res: Response) => {
    const context = apiGwContext();
    const event: ApiGwEventOptions = {
      method: req.method as 'GET' | 'POST' | 'OPTIONS',
      path: req.path,
      body: JSON.stringify(req.body),
      headers: req.headers as { [p: string]: string },
      pathParameters: req.params,
      queryStringParameters: req.query as { [p: string]: string | undefined } | undefined,
      origin: req.headers.host,
      ip: '169.0.15.7',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6,2 Safari/605.1.15',
    };

    const resp = await handler(apiGwEventV2(event), context);
    res.status(resp.statusCode).set(resp.headers).end(resp.body);
  });
  const server = app.listen(port);
  console.log('STARTED on: http://localhost:' + port);

  return server;
}

async function generateOpenApiSpecAndSDK() {
  /* Generate the OpenAPI spec file and save it to disk in YAML */
  const title = 'Pets API';
  const openApiDocument = generateOpenApiDocument(appRouter, {
    title,
    description: 'Pets API',
    version: API_PACKAGE.version,
    baseUrl: '-',
  });
  const openApiPath = path.join(paths.apiPackage, 'openapi.yaml');
  const openApiSpecYaml = yaml.dump(openApiDocument);
  await fse.writeFile(openApiPath, openApiSpecYaml);

  /* Generate the TS SDK */
  const outputFileName = 'index.ts';
  await generateApi({
    name: outputFileName,
    output: paths.apiPackage,
    input: path.join(paths.apiPackage, 'openapi.yaml'),
    // httpClientType: "axios",
    generateClient: true,
    generateRouteTypes: true,
    generateResponses: true,
    extractRequestParams: true,
    extractRequestBody: true,
    moduleNameFirstTag: true,
  });

  /* Transpile & bundle the TS SDK into JS and then create types for it */
  const apiClientTsFileInput = path.join(paths.apiPackage, outputFileName);
  const apiClientJsFileOut = path.join(paths.apiPackage, outputFileName.replace('.ts', '.js'));
  esbuild.buildSync({
    minify: true,
    bundle: true,
    target: ['node16'],
    keepNames: true,
    platform: 'node',
    format: 'esm',
    entryPoints: [apiClientTsFileInput],
    outfile: apiClientJsFileOut,
    allowOverwrite: true,
    sourcemap: 'linked',
    sourcesContent: false,
  });
  await runCommand('tsc', `--declaration --emitDeclarationOnly ${apiClientTsFileInput} --outDir ${paths.apiPackage}`, {
    cwd: paths.workingDir,
  });

  /* Remove the TS file that we used to generate JS and types. The packages will use the bundled JS + TS types */
  await fse.rm(apiClientTsFileInput, { force: true });
}

async function buildApiPackage() {
  if (!(await fse.pathExists(paths.apiPackage))) await fse.mkdir(paths.apiPackage);

  await generateOpenApiSpecAndSDK();

  /* Copy extra files needed for package */
  const apiPackageJson = {
    name: `@${API_PACKAGE.repoOwner}/${API_PACKAGE.repoName}`,
    version: API_PACKAGE.version,
    publishConfig: {
      registry: 'https://npm.pkg.github.com',
    },
    repository: `git://github.com/${API_PACKAGE.repoOwner}/${API_PACKAGE.repoName}.git`,
    description: 'Autogenerated SDK',
    license: 'Unlicense',
    main: './index.js',
    typings: './index.d.ts',
  };
  await fse.writeFile(path.join(paths.apiPackage, 'package.json'), JSON.stringify(apiPackageJson, null, 2));

  const ignoreFile = '.npmrc\n';
  await fse.writeFile(path.join(paths.apiPackage, '.gitignore'), ignoreFile);
  await fse.writeFile(path.join(paths.apiPackage, '.npmignore'), ignoreFile);
}

async function publishApiPackage() {
  const apiPackageRepoUrl = `https://github.com/${API_PACKAGE.repoOwner}/${API_PACKAGE.repoName}.git`;

  /* ============================ Ready the repo ============================ */
  if (await fse.pathExists(paths.apiPackage)) await fse.rm(paths.apiPackage, { force: true, recursive: true });
  if (!(await fse.pathExists(paths.apiPackage))) await fse.mkdir(paths.apiPackage);

  await runCommand('git', 'init', { cwd: paths.apiPackage });
  await runCommand('git', 'remote add origin ' + apiPackageRepoUrl, { cwd: paths.apiPackage });

  /* Fails if the repo does not have the branch or if you don't have permissions, assuming that it has the branch and that you have permission */
  try {
    await runCommand('git', 'fetch --all', { cwd: paths.apiPackage }, true, false);
    await runCommand('git', 'reset --hard origin/main', { cwd: paths.apiPackage }, true, false);
  } catch (err) {
    console.warn("Repository not found/empty OR you don't have permission.");
    console.log('Assuming you have permission - creating an empty branch..');
    try {
      await runCommand('git', 'checkout --orphan main', { cwd: paths.apiPackage }, true, false);
      await runCommand('git', 'commit --allow-empty -m "Empty branch"', { cwd: paths.apiPackage }, true, false);
      await runCommand('git', 'push -u origin main', { cwd: paths.apiPackage }, true, false);
    } catch (err) {
      console.warn('Creating an empty branch failed');
      console.log('If this is the first run and the repo is completely empty, create an empty branch by running:');
      console.log('cd ' + paths.apiPackage);
      console.log('git checkout --orphan main');
      console.log('git commit --allow-empty -m "Empty branch"');
      console.log('git push -u origin main');
      return;
    }
  }

  /* ====== Check the existing package version against the new version ======  */
  const existingPackageJsonPath = paths.apiPackage + '/package.json';
  if (await fse.exists(existingPackageJsonPath)) {
    const existingPackageJson = JSON.parse(await fse.readFile(existingPackageJsonPath, 'utf-8'));
    if (!semver.valid(API_PACKAGE.version)) throw new Error('API_PACKAGE.version does not follow semantic versioning');
    else if (semver.eq(existingPackageJson.version, API_PACKAGE.version))
      throw new Error('API_PACKAGE.version version is the same as the published SDK version, no need to publish');
    else if (semver.lt(API_PACKAGE.version, existingPackageJson.version))
      throw new Error('API_PACKAGE.version can not be less than the current published SDK version');
  }

  /* ========================== Generate the files ========================== */
  await buildApiPackage();

  /* ==================== Commit and Publish the package ==================== */
  /* We Need the .npmrc in the /api-package dir to publish with those credentials */
  if (await fse.exists(paths.workingDir + '/.npmrc'))
    await fse.copyFile(paths.workingDir + '/.npmrc', paths.apiPackage + '/.npmrc');
  else
    throw new Error(
      'No .npmrc file found in the root directory, copy the .npmrc.example file to .npmrc and fill in the details'
    );

  const commitMessage = 'v' + API_PACKAGE.version;
  console.log('New SDK version' + API_PACKAGE.version);

  /* Commit changed files and publish the NPM package to GitHub */
  await runCommand('git', 'checkout main', { cwd: paths.apiPackage });
  await runCommand('git', 'add .', { cwd: paths.apiPackage });
  await runCommand('git', 'commit -m "' + commitMessage + '"', { cwd: paths.apiPackage });
  await runCommand('git', 'push origin main', { cwd: paths.apiPackage });
  await runCommand('npm', 'publish', { cwd: paths.apiPackage });

  await buildApiPackage();
}
