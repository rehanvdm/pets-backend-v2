import { describe, expect, it } from 'vitest';
import { handler } from '@backend/lambda/api';
import {
  apiGwContext,
  ApiGwEventOptions,
  invokeLocalHandlerOrMakeAPICall,
  setEnvVariables,
  TEST_TYPE,
} from '@tests/helpers';
import { AppRouter } from '@backend/lambda/api/server';
import { TEST_VARIABLES } from '@config/index';
import { envToObject } from '@backend/lambda/api/environment';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

type ApiRouterInput = inferRouterInputs<AppRouter>;
type RouterOutput = inferRouterOutputs<AppRouter>;

const ECHO_TEST_OUTPUTS = true;
// Set one of these, defaults to unit that runs the function locally, e2e does an API call.
// process.env.TEST_TYPE = TEST_TYPE.UNIT;
// process.env.TEST_TYPE = TEST_TYPE.E2E;

describe('Pets tests', function () {
  /* So that can be set externally */
  if (!process.env.TEST_TYPE) {
    process.env.TEST_TYPE = TEST_TYPE.UNIT;
  }

  it('OPTIONS', async function () {
    if (process.env.TEST_TYPE === TEST_TYPE.UNIT) {
      console.log('Skipping unit test, CORs is handled by AWS services, we are not catering for it in the code');
      return;
    }

    const context = apiGwContext();
    const input: ApiRouterInput['petGetAll'] = undefined;
    const event: ApiGwEventOptions = {
      method: 'OPTIONS',
      path: '/pets',
      body: JSON.stringify(input),
      headers: {
        Host: '2n2lbqfmqgqqs4436oghjbkv540duqqa.lambda-url.us-east-1.on.aws',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
        Origin: 'https://d2urleacaiuo7i.cloudfront.net',
        Connection: 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
    };

    setEnvVariables(envToObject(TEST_VARIABLES.env.api));
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TEST_VARIABLES.api_url, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(200);
  });

  it('docs', async function () {
    const context = apiGwContext();
    const event: ApiGwEventOptions = {
      method: 'GET',
      path: '/docs',
      body: undefined,
      origin: 'xxx',
    };

    setEnvVariables(envToObject(TEST_VARIABLES.env.api));
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TEST_VARIABLES.api_url, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(200);
  });

  it('petsGetAll', async function () {
    const context = apiGwContext();
    const input: ApiRouterInput['petGetAll'] = undefined;
    const event: ApiGwEventOptions = {
      method: 'GET',
      path: '/pets',
      body: JSON.stringify(input),
      origin: 'xxx',
    };

    setEnvVariables(envToObject(TEST_VARIABLES.env.api));
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TEST_VARIABLES.api_url, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(200);
    const respData = JSON.parse(resp.body);
    expect(respData.length > 0).to.be.eq(true);
  });

  it('petCreate', async function () {
    const context = apiGwContext();
    const input: ApiRouterInput['petCreate'] = {
      type: 'dog',
      name: 'fido' + Date.now(),
    };
    const event: ApiGwEventOptions = {
      method: 'POST',
      path: '/pets',
      body: JSON.stringify(input),
      origin: 'xxx',
    };

    setEnvVariables(envToObject(TEST_VARIABLES.env.api));
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TEST_VARIABLES.api_url, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(200);
    const respData = JSON.parse(resp.body) as RouterOutput['petCreate'];
    expect(respData.length > 0).to.be.eq(true);
    expect(respData.filter((pet) => pet.name === input.name).length).to.eq(1);
  });

  it('petGet', async function () {
    const context = apiGwContext();
    const input: ApiRouterInput['petGet'] = {
      pet_id: 1,
    };
    const event: ApiGwEventOptions = {
      method: 'GET',
      path: `/pets/${input.pet_id}`,
      body: undefined,
      origin: 'xxx',
    };

    setEnvVariables(envToObject(TEST_VARIABLES.env.api));
    const resp = await invokeLocalHandlerOrMakeAPICall(event, handler, TEST_VARIABLES.api_url, context);
    ECHO_TEST_OUTPUTS && console.log(resp);

    expect(resp.statusCode).to.eq(200);
    const respData = JSON.parse(resp.body) as RouterOutput['petGet'];
    expect(respData.id).to.be.eq(input.pet_id);
  });
});
