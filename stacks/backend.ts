import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { HttpMethod } from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';
import { ApiEnv, envToObject } from '@backend/lambda/api/environment';
import { API_ENV } from '@config/index';

export class Backend extends cdk.Stack {
  constructor(scope: Construct, id: string, stackProps: cdk.StackProps) {
    super(scope, id, stackProps);

    function name(name: string): string {
      return id + '-' + name;
    }

    const apiEnv: ApiEnv = {
      ENVIRONMENT: API_ENV.ENVIRONMENT,
    };
    const apiLambda = new lambda.Function(this, name('lambda-api'), {
      functionName: name('api'),
      code: new lambda.AssetCode('dist/backend/lambda/api/'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.seconds(5),
      memorySize: 1024,
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        NODE_OPTIONS: '--enable-source-maps',
        ...envToObject(apiEnv),
      },
    });
    const apiLambdaUrl = apiLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        allowedMethods: [HttpMethod.ALL],
      },
    });

    /* Add this to pets-frontend-v2 /src/frontend/.env.production */
    new cdk.CfnOutput(this, 'Lambda API Host', {
      value: apiLambdaUrl.url,
    });
  }
}

export default Backend;
