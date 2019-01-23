dummy:
	@echo "Supported targets:"
	@echo "    - setup_environment"
	@echo "    - cleanup_container"
	@echo "    - prepare_npm"
	@echo "    - run_all: run all defined testcases"
	@echo "    - run_single: run a given set of defined testcases"
	@echo ""
	@echo ""

prepare: setup_environment cleanup_containers

all: prepare run_all

setup_environment:
	bash libs/setup_environment.sh

cleanup_containers:
	@docker ps -qa | xargs -r docker rm -f

# TESTCASE is used to limit the testcase to run if defined.
run_all:
	DEBUG=$(DEBUG) bash libs/run_scenario.sh

run_single:
	TESTCASE=$(TESTCASE) bash libs/run_single_testcase.sh
