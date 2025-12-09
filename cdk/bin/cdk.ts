#!/usr/bin/env node
//import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';

import { NetworkStack } from "../lib/network-stack";

import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';


const app = new cdk.App();
new PipelineStack(app, 'SimplePipelineStack');

new NetworkStack(app, "NetworkStack");
