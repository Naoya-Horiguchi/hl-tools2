. libs/env.sh

export LOGDIR=logs/$RUNNAME

collect_application_logs() {
	local label=$1

	mkdir -p $LOGDIR/$label
	docker inspect --format='{{.LogPath}}' app | xargs cat > $LOGDIR/$label/app.log

	# filtering
	sed -e "s/\(,[0-9]\+\)\{10,1000\}/...<filtered>.../g" $TMPD/stdout > $LOGDIR/$label/stdout
}

collect_fabric_network_logs() {
	local scenario=$1

	mkdir -p $LOGDIR/$scenario
	for container in $(docker ps -a --format='{{.Names}}' | grep -v ^app$) ; do
		docker inspect --format='{{.LogPath}}' $container | xargs cat > $LOGDIR/$scenario/$container.log
	done
}

decide_result() {
	local resdir=$1
	local result=$2
	local reason="$3"

	echo "Result: $TESTCASE: $result: $reason"
	echo "result: $result" >  $resdir/result
	echo "reason: $reason" >> $resdir/result
}

decide_pass_fail() {
	local return_code=$1
	local resdir=$LOGDIR/$2
	mkdir -p $resdir

	if [ "$return_code" -ne 0 ] ; then
		decide_result $resdir FAIL "return code of the scenario workflow was 'FAIL'"
		exit 1
	fi

	# Testcase specific log checker
	if [ "$(type -t log_check)" == "function" ] ; then
		log_check > $TMPD/log_check_out
		if [ $? -ne 0 ] ; then
			decide_result $resdir FAIL "log_check() found unexpected failure: $(tail -n1 $TMPD/log_check_out)"
			exit 1
		fi
	fi

	# some general log checker here.

	decide_result $resdir PASS ""
}
