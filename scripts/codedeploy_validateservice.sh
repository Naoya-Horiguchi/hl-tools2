make -C tests/v1.3.0/balance-transfer prepare
make -C tests/v1.3.0/balance-transfer run_all
bash scripts/save_output.sh $APPLICATION_NAME
