"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const codepipeline = __importStar(require("aws-cdk-lib/aws-codepipeline"));
const codepipeline_actions = __importStar(require("aws-cdk-lib/aws-codepipeline-actions"));
const codebuild = __importStar(require("aws-cdk-lib/aws-codebuild"));
const ecr = __importStar(require("aws-cdk-lib/aws-ecr"));
class PipelineStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // ------------------------------
        // 1. Create ECR Repository
        // ------------------------------
        const repo = new ecr.Repository(this, "FlaskRepoo2", {
            repositoryName: "flask-docker-appp2",
        });
        // ------------------------------
        // 2. GitHub Source Action
        // ------------------------------
        const sourceOutput = new codepipeline.Artifact();
        const connectionArn = "arn:aws:codeconnections:us-east-1:456582263462:connection/bc825e8d-e9cb-4c4f-b1da-0d54dc99db01";
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
        repo.grantPullPush(buildProject.role);
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
exports.PipelineStack = PipelineStack;
