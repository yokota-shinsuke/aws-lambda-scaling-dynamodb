var AWS = require('aws-sdk');
var async = require('async');

var increaseReadPercentage = 20;
var increaseWritePercentage = 20;
var readAlarmThreshold = 80;
var writeAlarmThreshold = 80;

var region = {
  'APAC - Tokyo': 'ap-northeast-1',
  '...': '...'
};

exports.handler = function(event, context) {
  var message = JSON.parse(event.Records[0].Sns.Message) ; 
  if (message.NewStateValue =! 'ALARM') context.succeed(message);

  AWS.config.update({ region: region[message.Region]});
  async.waterfall(
    [
      // modify throughput
      function (callback) {
        var dynamodb = new AWS.DynamoDB();
        var dynamodbTable = message.Trigger.Dimensions[0].value;
        dynamodb.describeTable({TableName: dynamodbTable}, function(err, tableInfo) {
          if (err) callback(err);
          else {
            var params = {
              TableName: dynamodbTable
            }

            var currentThroughput = tableInfo.Table.ProvisionedThroughput;
            if (message.Trigger.MetricName == 'ConsumedReadCapacityUnits') {
              params.ProvisionedThroughput = {
                ReadCapacityUnits: Math.ceil(currentThroughput.ReadCapacityUnits * (100 + increaseReadPercentage)/100),
                WriteCapacityUnits: currentThroughput.WriteCapacityUnits
              };
            }
            else if (message.Trigger.MetricName == 'ConsumedWriteCapacityUnits') {
              params.ProvisionedThroughput = {
                ReadCapacityUnits: currentThroughput.ReadCapacityUnits,
                WriteCapacityUnits: Math.ceil(currentThroughput.WriteCapacityUnits * (100 + increaseWritePercentage)/100)
              };
            }
            else {
              callback(message);
            }
            dynamodb.updateTable(params, function(err, response) {
              if (err) callback(err);
              else {
                console.log('modify provisioned throughput:', currentThroughput, params);
                callback(null, params.ProvisionedThroughput);
              }
            });
          }
        });
      },
      // modify CloudWatch Alarm
      function (newThroughput, callback) {
        var cloudwatch = new AWS.CloudWatch();
        cloudwatch.describeAlarms({AlarmNames: [message.AlarmName]}, function(err, alarms) {
          if (err) callback(err);
          else {
            var currentAlarm = alarms.MetricAlarms[0];
            var params = {
              AlarmName: currentAlarm.AlarmName,
              ComparisonOperator: currentAlarm.ComparisonOperator,
              EvaluationPeriods: currentAlarm.EvaluationPeriods,
              MetricName: currentAlarm.MetricName,
              Namespace: currentAlarm.Namespace,
              Period: currentAlarm.Period,
              Statistic: currentAlarm.Statistic,
              ActionsEnabled: currentAlarm.ActionsEnabled,
              AlarmActions: currentAlarm.AlarmActions,
              AlarmDescription: currentAlarm.AlarmDescription,
              Dimensions: currentAlarm.Dimensions,
              InsufficientDataActions: currentAlarm.InsufficientDataActions,
              OKActions: currentAlarm.OKActions,
              Unit: currentAlarm.Unit,
            }
            if (message.Trigger.MetricName == 'ConsumedReadCapacityUnits') {
              params.Threshold = newThroughput.ReadCapacityUnits * params.Period * readAlarmThreshold / 100;
            }
            else {
              params.Threshold = newThroughput.WriteCapacityUnits * params.Period * writeAlarmThreshold / 100;
            }
            cloudwatch.putMetricAlarm(params, function(err, response) {
              if (err) callback(err);
              else {
                console.log('modify alarm:', currentAlarm, params);
                callback(null, response);
              }
            });
          }
        });
      }
    ],
    function (err, result) {
      if (err) {context.fail(err);}
      else {context.succeed(result);}
    }
  );
}

 // exports.handler(event, {done: function(){process.exit();}});
