if [ ! "$JOB_NAME" ] ; then
	JOB_NAME=$1
fi

if [ ! "$JOB_NAME" ] ; then
	echo "environment variable JOB_NAME not given." >&2
	exit 1
fi

role=n-horiguchi_role_for_ecr_user
curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/$role > /tmp/seccred
accessKeyId=$(jq -r '.AccessKeyId' /tmp/seccred)
secretAccessKey=$(jq -r '.SecretAccessKey' /tmp/seccred)
sessionToken=$(jq -r '.Token' /tmp/seccred)

export AWS_ACCESS_KEY_ID=$accessKeyId
export AWS_SECRET_ACCESS_KEY=$secretAccessKey
export AWS_SESSION_TOKEN=$sessionToken
export AWS_DEFAULT_REGION=ap-northeast-1

AWSCMD="$HOME/.local/bin/aws"
if [ ! -e "$AWSCMD" ] ; then
	AWSCMD=aws
fi
echo "---> $AWSCMD s3 ls --region $AWS_DEFAULT_REGION)"
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN=$AWS_SESSION_TOKEN $AWSCMD s3 ls --region $AWS_DEFAULT_REGION || exit 1

RUNID=$(date +%y%m%d_%H%M%S)
LOGS_TGZ=logs-${RUNID}.tar.gz
tar -zcvf $LOGS_TGZ logs/

echo "---> $AWSCMD s3 cp $LOGS_TGZ s3://n-horiguchi-test-logs/test_class/"
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN=$AWS_SESSION_TOKEN $AWSCMD s3 cp $LOGS_TGZ s3://n-horiguchi-test-logs/test_class/ || exit 1

echo "---> Summary"
find logs -type f | grep /result$ | while read line ; do
	echo $line
	cat $line
done

exit 0
