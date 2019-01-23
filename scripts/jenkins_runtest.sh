cd /home/ubuntu/workspace/$JOB_NAME/tests/v1.3.0/balance-transfer
echo "Running Testcases"
echo "$(date): $(hostname)"
make prepare
make run_all
bash -c "PATH=$PATH bash /home/ubuntu/workspace/$JOB_NAME/jenkins/save_output.sh $JOB_NAME n-horiguchi_ec2_role_for_codeDeploy"
