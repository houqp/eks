// Copyright 2016-2018, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as aws from "@pulumi/aws";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs";
import * as path from "path";

export interface ClusterAutoscalerOptions {
    instanceRoles: pulumi.Input<aws.iam.Role[]>;
    clusterName: pulumi.Input<string>;
}

export function createClusterAutoscaler(name: string, args: ClusterAutoscalerOptions, parent: pulumi.ComponentResource, k8sProvider: k8s.Provider) {
    // create autoscaling policy
    const autoscalerPolicy = JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Action: [
                "ec2:DescribeAvailabilityZones",
                "ec2:DescribeRegions",
                "ec2:DescribeLaunchTemplateVersions",
                "autoscaling:DescribeAutoScalingGroups",
                "autoscaling:DescribeAutoScalingInstances",
                "autoscaling:DescribeTags",
                "autoscaling:DescribeLaunchConfigurations",
                "autoscaling:SetDesiredCapacity",
                "autoscaling:TerminateInstanceInAutoScalingGroup",
            ],
            Effect: "Allow",
            Resource: "*",
        }],
    });

    pulumi.output(args.instanceRoles).apply(roles => roles.map(role => {
        // TODO: change name
        const autoScalerRolePolicy = new aws.iam.RolePolicy(
            `${name}-EKSWorkerAutoscaler`, {
            role: role,
            policy: autoscalerPolicy,
        });
    }));

    let autoscalerYaml = fs.readFileSync(
        path.join(__dirname, "autoscaler", "cluster-autoscaler-autodiscover.yaml")
    ).toString();
    pulumi.output(args.clusterName).apply(clustername => {
        autoscalerYaml = autoscalerYaml.replace("<YOUR CLUSTER NAME>", clustername);
        // TODO: lookup region
        // autoscalerYaml = autoscalerYaml.replace("<AWS_REGION>", awsRegion);
        const clusterScaler = new k8s.yaml.ConfigGroup(
            "clusterAutoscaler", {
                yaml: autoscalerYaml,
            }, {
            providers: { kubernetes: k8sProvider },
            // dependsOn: nodeGroupResources,
        });
    });
}