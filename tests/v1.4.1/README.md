# Run Raft consensus on Hyperledger Fabric v1.4.1

## Procedure

    git clone https://github.com/Naoya-Horiguchi/hl-tools2
    cd hl-tools2/
    git submodule init tests/v1.4.1/fabric-samples
    git submodule update tests/v1.4.1/fabric-samples
    cd tests/v1.4.1
    make prepare
    TESTCASE=cases/balance-transfer/raft make run_single
