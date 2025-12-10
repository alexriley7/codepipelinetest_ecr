import * as cdk from "aws-cdk-lib";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ------------------------------
    // 1. Create ECR Repository
    // ------------------------------
    const repo = new ecr.Repository(this, "FlaskRepoFinal", {
      repositoryName: "flask-docker-final",
    });

    // ------------------------------
    // 2. Source (GitHub)
    // ------------------------------
    const sourceOutput = new codepipeline.Artifact();
    const synthOutput = new codepipeline.Artifact("SynthOutput");

    const sourceAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
      actionName: "GitHub_Source",
      owner: "alexriley7",
      repo: "codepipelinetest_ecr",
      branch: "master",
      connectionArn:
        "arn:aws:codeconnections:us-east-1:456582263462:connection/bc825e8d-e9cb-4c4f-b1da-0d54dc99db01",
      output: sourceOutput,
      triggerOnPush: true,
    });

    // ------------------------------
    // 3. CodeBuild - CDK Synth Stage
    // ------------------------------
    const synthProject = new codebuild.PipelineProject(this, "SynthProject", {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            commands: [
              "echo Installing CDK dependencies...",
              "cd cdk",
              "npm ci",
            ],
          },
          build: {
            commands: [
              "echo Running CDK build...",
              "echo heyy..",
              "ls -la",
              "npm run build",
              "echo Synthesizing CDK...",
              "npx cdk synth NetworkStack --quiet > ../cdk.out/network-stack.template.json"
            ],
          },
        },
        artifacts: {
          "base-directory": "cdk.out",
          files: ["network-stack.template.json"],
        },
      }),
    });

    // ------------------------------
    // 4. CodeBuild - Docker Build & Push to ECR
    // ------------------------------
    const dockerProject = new codebuild.PipelineProject(this, "DockerBuild", {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
      },
      environmentVariables: {
        ECR_REPO_URI: { value: repo.repositoryUri },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          pre_build: {
            commands: [
              "echo Logging into ECR...",
              "aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI",
            ],
          },
          build: {
            commands: [
              "echo Building Docker image...",
              "cd cdk/..",
              "docker build -t flask-app .",
              "docker tag flask-app:latest $ECR_REPO_URI:latest",
            ],
          },
          post_build: {
            commands: [
              "echo Pushing Docker image...",
              "docker push $ECR_REPO_URI:latest",
            ],
          },
        },
      }),
    });

    repo.grantPullPush(dockerProject.role!);

    // ------------------------------
    // 5. Pipeline Definition
    // ------------------------------
    const pipeline = new codepipeline.Pipeline(this, "PipelineFinal", {
      pipelineName: "FlaskDockerPipelineFinal",
    });

    // SOURCE
    pipeline.addStage({
      stageName: "Source",
      actions: [sourceAction],
    });

    // SYNTH (creates VPC template)
    pipeline.addStage({
      stageName: "Synth",
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: "CDK_Synth",
          project: synthProject,
          input: sourceOutput,
          outputs: [synthOutput],
        }),
      ],
    });

    // DEPLOY VPC
    pipeline.addStage({
      stageName: "Create_VPC",
      actions: [
        new codepipeline_actions.CloudFormationCreateUpdateStackAction({
          actionName: "DeployNetworkStack",
          stackName: "NetworkStackFromPipeline",
          adminPermissions: true,
          templatePath: synthOutput.atPath("network-stack.template.json"),
        }),
      ],
    });

    // DOCKER BUILD & PUSH
    pipeline.addStage({
      stageName: "BuildAndPushDocker",
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: "DockerBuild",
          project: dockerProject,
          input: sourceOutput,
        }),
      ],
    });
  }
}
