# load hierarchically defined config files.
load_testcase_config() {
	local testcase=$1
	local tmp=

	if [ -f "cases/config" ] ; then
		source "cases/config"
	fi

	for dir in $(echo $testcase | tr '/' ' ') ; do
		tmp="$tmp/$dir"
		if [ -f "cases$tmp/config" ] ; then
			# echo source "cases$tmp/config" # DEBUG
			source "cases$tmp/config"
		fi
	done
}
