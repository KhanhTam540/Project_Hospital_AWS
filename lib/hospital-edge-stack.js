'use strict';

const { CfnOutput, RemovalPolicy, Stack } = require('aws-cdk-lib');
const wafv2 = require('aws-cdk-lib/aws-wafv2');

function managedRule({ name, priority, managedRuleGroupName }) {
  return {
    name,
    priority,
    overrideAction: { none: {} },
    statement: {
      managedRuleGroupStatement: {
        vendorName: 'AWS',
        name: managedRuleGroupName,
      },
    },
    visibilityConfig: {
      cloudWatchMetricsEnabled: true,
      metricName: name,
      sampledRequestsEnabled: true,
    },
  };
}

class HospitalEdgeStack extends Stack {
  constructor(scope, id, props = {}) {
    super(scope, id, props);

    if (this.region !== 'us-east-1') {
      throw new Error(
        'HospitalEdgeStack must be deployed in us-east-1 because ' +
          'AWS WAF with scope CLOUDFRONT is managed in that Region.',
      );
    }

    const retainEdgeSecurity =
      String(process.env.RETAIN_EDGE_SECURITY || 'false')
        .trim()
        .toLowerCase() === 'true';
    const removalPolicy = retainEdgeSecurity
      ? RemovalPolicy.RETAIN
      : RemovalPolicy.DESTROY;

    const webAcl = new wafv2.CfnWebACL(
      this,
      'HospitalCloudFrontWebAcl',
      {
        name: 'hospital-dev-cloudfront-waf',
        scope: 'CLOUDFRONT',
        description:
          'AWS WAF protection for the Hospital P2TB CloudFront distribution.',
        defaultAction: { allow: {} },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'HospitalP2TBCloudFrontWebAcl',
          sampledRequestsEnabled: true,
        },
        rules: [
          managedRule({
            name: 'AWSCommonRules',
            priority: 10,
            managedRuleGroupName: 'AWSManagedRulesCommonRuleSet',
          }),
          managedRule({
            name: 'AWSKnownBadInputs',
            priority: 20,
            managedRuleGroupName:
              'AWSManagedRulesKnownBadInputsRuleSet',
          }),
          managedRule({
            name: 'AWSIpReputation',
            priority: 30,
            managedRuleGroupName:
              'AWSManagedRulesAmazonIpReputationList',
          }),
          {
            name: 'PerIpRateLimit',
            priority: 40,
            action: { block: {} },
            statement: {
              rateBasedStatement: {
                aggregateKeyType: 'IP',
                limit: 2000,
              },
            },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: 'PerIpRateLimit',
              sampledRequestsEnabled: true,
            },
          },
        ],
      },
    );

    webAcl.applyRemovalPolicy(removalPolicy);

    new CfnOutput(this, 'WebAclArn', {
      value: webAcl.attrArn,
      description:
        'Set this value as CLOUDFRONT_WEB_ACL_ARN before deploying HospitalDevStack.',
    });

    new CfnOutput(this, 'WebAclName', {
      value: webAcl.name || 'hospital-dev-cloudfront-waf',
    });

    new CfnOutput(this, 'DomainMode', {
      value: 'DEFAULT_CLOUDFRONT_NET',
    });
  }
}

module.exports = { HospitalEdgeStack };
