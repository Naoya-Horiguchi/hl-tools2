role=n-horiguchi_role_for_ecr_user
curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/$role > /tmp/seccred
accessKeyId=$(jq -r '.AccessKeyId' /tmp/seccred)
secretAccessKey=$(jq -r '.SecretAccessKey' /tmp/seccred)
sessionToken=$(jq -r '.Token' /tmp/seccred)

export AWS_ACCESS_KEY_ID=$accessKeyId
export AWS_SECRET_ACCESS_KEY=$secretAccessKey
export AWS_SESSION_TOKEN=$sessionToken
export AWS_DEFAULT_REGION=ap-northeast-1

curl https://s3.amazonaws.com/aws-cloudwatch/downloads/latest/awslogs-agent-setup.py -O

cat <<EOF > /tmp/awslogs.config
[general]
state_file = /var/awslogs/state/agent-state

[/var/log/syslog]
datetime_format = %b %d %H:%M:%S
file = /var/log/syslog
buffer_duration = 5000
log_group_name = n-horiguchi_cloudwatch_log_group1
log_stream_name = n-horiguchi_log_stream
initial_position = start_of_file
EOF

sudo python ./awslogs-agent-setup.py -n -r ap-northeast-1 -c /tmp/awslogs.config

cat <<EOF > /tmp/aws.conf
[plugins]
cwlogs = cwlogs
[default]
aws_access_key_id = $accessKeyId
aws_secret_access_key = $secretAccessKey
aws_session_token = $sessionToken
region = ap-northeast-1
EOF

sudo cp /tmp/aws.conf /var/awslogs/etc/aws.conf

sudo service status awslogs
