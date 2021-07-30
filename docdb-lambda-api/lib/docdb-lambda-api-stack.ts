import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as docdb from '@aws-cdk/aws-docdb';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigateway from '@aws-cdk/aws-apigateway';

import { config } from 'dotenv';
config();
export class DocdbLambdaApiStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const vpcCidr = '10.0.0.0/21';
    const port = 27017;

    const vpc = new ec2.Vpc(this, 'vpc', {
      cidr: vpcCidr,
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PRIVATE,
          cidrMask: 24,
          name: 'PrivateSubnet1',
        },
        {
          subnetType: ec2.SubnetType.PRIVATE,
          cidrMask: 24,
          name: 'PrivateSubnet2',
        },
        {
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 28,
          name: 'PublicSubnet1',
        },
      ],
    });

    const sg = new ec2.SecurityGroup(this, 'docdb-lambda-sg', {
      vpc,
      securityGroupName: 'docdb-lambda-sg',
    });

    const subnetGroup = new docdb.CfnDBSubnetGroup(this, 'subnet-group', {
      subnetIds: vpc.privateSubnets.map((x) => x.subnetId),
      dbSubnetGroupName: 'subnet-group',
      dbSubnetGroupDescription: 'Subnet Group for DocDB',
    });

    const dbCluster = new docdb.CfnDBCluster(this, 'db-cluster', {
      storageEncrypted: true,
      availabilityZones: vpc.availabilityZones.splice(3),
      dbClusterIdentifier: 'docdb',
      masterUsername: 'dbuser',
      masterUserPassword: process.env.MASTER_USER_PASSWORD as string,
      vpcSecurityGroupIds: [sg.securityGroupName],
      dbSubnetGroupName: subnetGroup.dbSubnetGroupName,
      port,
    });
    dbCluster.addDependsOn(subnetGroup);

    const dbInstance = new docdb.CfnDBInstance(this, 'db-instance', {
      dbClusterIdentifier: dbCluster.ref,
      autoMinorVersionUpgrade: true,
      dbInstanceClass: 'db.r5.large',
      dbInstanceIdentifier: 'staging',
    });
    dbInstance.addDependsOn(dbCluster);

    sg.addIngressRule(ec2.Peer.ipv4(vpcCidr), ec2.Port.tcp(port));

    const DB_URL = `mongodb://${dbCluster.masterUsername}:${dbCluster.masterUserPassword}@${dbCluster.attrEndpoint}:${dbCluster.attrPort}/${dbInstance.dbInstanceIdentifier}?tls=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`;

    const DB_NAME = dbInstance.dbInstanceIdentifier as string;

    const urlShortener = new lambda.Function(this, 'urlShortener', {
      functionName: 'urlShortener',
      runtime: lambda.Runtime.NODEJS_10_X,
      vpc,
      code: new lambda.AssetCode('src'),
      handler: 'urlShortener.handler',
      timeout: cdk.Duration.seconds(60),
      securityGroup: sg,
      environment: {
        DB_URL,
        DB_NAME,
      },
    });

    const getLongURL = new lambda.Function(this, 'getLongURL', {
      functionName: 'getLongURL',
      runtime: lambda.Runtime.NODEJS_10_X,
      vpc,
      code: new lambda.AssetCode('src'),
      handler: 'getLongURL.handler',
      timeout: cdk.Duration.seconds(60),
      securityGroup: sg,
      environment: {
        DB_URL,
        DB_NAME,
      },
    });

    const api = new apigateway.RestApi(this, 'api', {
      restApiName: 'url-shortener',
    });

    const urls = api.root.addResource('urls');
    const urlShortenerLambdaIntegration = new apigateway.LambdaIntegration(
      urlShortener
    );
    urls.addMethod('POST', urlShortenerLambdaIntegration);

    const singleURL = urls.addResource(`{id}`);
    const getLongURLLambdaIntegration = new apigateway.LambdaIntegration(
      getLongURL
    );
    singleURL.addMethod('GET', getLongURLLambdaIntegration);

    new cdk.CfnOutput(this, 'db-url', {
      value: DB_URL,
    });
  }
}
