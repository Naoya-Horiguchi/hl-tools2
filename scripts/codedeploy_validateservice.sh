env
cdir=$(pwd)
testdir=deployment-root/$DEPLOYMENT_GROUP_ID/$DEPLOYMENT_ID/deployment-archive/tests/v1.3.0/balance-transfer

echo "cd $testdir" | tee -a /tmp/100
cd $testdir 2>&1 | tee -a /tmp/100
echo /opt/codedeploy-agent/$testdir 2>&1 | tee -a /tmp/100
cd /opt/codedeploy-agent/$testdir 2>&1 | tee -a /tmp/100
pwd | tee -a /tmp/100
ls -ltra | tee -a /tmp/100
echo "make prepare run_all" | tee -a /tmp/100
# make prepare run_all
# bash scripts/save_output.sh $APPLICATION_NAME
