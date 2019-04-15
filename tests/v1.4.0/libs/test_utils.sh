# load hierarchically defined config files.
load_testcase_config() {
	local tcdir=$1
	local tmp=
	local dir=

	for dir in $(echo $tcdir | tr '/' ' ') ; do
		tmp="$tmp/$dir"
		if [ -f "${tmp##/}/config" ] ; then
			source "${tmp##/}/config"
		fi
	done
}
