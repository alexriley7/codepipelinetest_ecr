import * as cdk from "aws-cdk-lib";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";

import * as iam from "aws-cdk-lib/aws-iam";

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ------------------------------
    // 1. Create ECR Repository
    // ------------------------------
    const repo = new ecr.Repository(this, "FlaskRepoo3", {
      repositoryName: "flask-docker-appp3",
    });

    // ------------------------------
    // 2. GitHub Source Action
    // ------------------------------
    const sourceOutput = new codepipeline.Artifact();

    const connectionArn =
      "arn:aws:codeconnections:us-east-1:456582263462:connection/bc825e8d-e9cb-4c4f-b1da-0d54dc99db01";

    const sourceAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
      actionName: "GitHub_Source",
      owner: "alexriley7",
      repo: "codepipelinetest_ecr",
      branch: "master",
      output: sourceOutput,
      connectionArn,
      triggerOnPush: true,
    });

    // ------------------------------
    // 3. CodeBuild project to build & push Docker image
    // ------------------------------
    const buildProject = new codebuild.PipelineProject(this, "DockerBuildProjectt1", {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true, // Docker required
      },
      environmentVariables: {
        ECR_REPO_URI: { value: repo.repositoryUri },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          pre_build: {
            commands: [
              "echo Logging in to Amazon ECR...",
              "aws --version",
              "aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI",
            ],
          },
          build: {
            commands: [
              "echo Building Docker image...",
              "docker build -t flask-app .",
              "docker tag flask-app:latest $ECR_REPO_URI:latest",
            ],
          },
          post_build: {
            commands: [
              "echo Pushing Docker image to ECR...",
              "docker push $ECR_REPO_URI:latest",
            ],
          },
        },
      }),
    });

    // Allow CodeBuild to push to ECR
    repo.grantPullPush(buildProject.role!);

    // ------------------------------
    // 4. Pipeline
    // ------------------------------
    const pipeline = new codepipeline.Pipeline(this, "FlaskDockerPipelinee1", {
      pipelineName: "FlaskDockerPipelinee1",
    });


      

    // Add stages
    pipeline.addStage({
      stageName: "Source",
      actions: [sourceAction],
    });


    // Stage 2: Deploy VPC (NetworkStack)
    pipeline.addStage({
        stageName: "Create_VPC",
        actions: [
          new codepipeline_actions.CloudFormationCreateUpdateStackAction({
            actionName: "DeployNetworkStack",
            stackName: "NetworkStackFromPipeline",
            templatePath: sourceOutput.atPath("network-stack.template.json"),
            adminPermissions: true,
          }),
        ],
      });

    pipeline.addStage({
      stageName: "BuildAndPushDocker",
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: "DockerBuild",
          project: buildProject,
          input: sourceOutput,
        }),
      ],
    });
  }
}
