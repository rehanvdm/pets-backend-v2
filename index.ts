import { ENVIRONMENT } from '@config/index';
import * as cdk from 'aws-cdk-lib';
import Backend from './stacks/backend';

const app = new cdk.App();
async function Main() {
  cdk.Tags.of(app).add('blog', 'pets-backend-v2');

  const env = {
    region: ENVIRONMENT.region,
    account: ENVIRONMENT.account,
  };
  console.log('CDK ENV', env);

  new Backend(app, 'pets-backend-v2', { env });

  app.synth();
}

Main().catch((err) => {
  console.error(err);
  process.exit(1);
});
