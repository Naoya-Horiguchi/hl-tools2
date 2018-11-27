role=n-horiguchi_role_for_ecr_user
[ "$1" ] && role=n-horiguchi_role1

curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/$role > /tmp/seccred
accessKeyId=$(jq -r '.AccessKeyId' /tmp/seccred)
secretAccessKey=$(jq -r '.SecretAccessKey' /tmp/seccred)
sessionToken=$(jq -r '.Token' /tmp/seccred)

export AWS_ACCESS_KEY_ID=$accessKeyId
export AWS_SECRET_ACCESS_KEY=$secretAccessKey
export AWS_SESSION_TOKEN=$sessionToken
export AWS_DEFAULT_REGION=ap-northeast-1
