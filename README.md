# scalingDynamoDB
This is AWS Lambda function to scale up DynamoDB table triggerd by CloudWatch Alarm.

## How To Use
http://dev.classmethod.jp/etc/auto-scaling-dynamodb-by-lambda/

```
aws lambda create-function \
  --function-name "scalingDynamoDB" \
  --runtime nodejs\
  --role arn:aws:iam::{your-account-id}:role/{role-name}\
  --handler "scalingDynamoDB.handler"\
  --timeout 60\
  --zip-file "fileb://scalingDynamoDB.zip"\
  --region ap-northeast-1
```
