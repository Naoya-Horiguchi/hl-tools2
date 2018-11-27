# TODO: assuming username 'ubuntu' is OK?

if [ ! "$JOB_NAME" ] ; then
	JOB_NAME=$1
fi

if [ ! "$JOB_NAME" ] ; then
	echo "environment variable JOB_NAME not given." >&2
	exit 1
fi

sudo ln -sf /usr/bin/python3 /usr/bin/python

# used in Jenkins build task
sudo killall apt apt-get
sudo rm -f /var/lib/dpkg/lock
sudo apt-get -qq update
sudo apt-get -qq install -y make jq gcc g++ python3-pip apt-transport-https ca-certificates curl software-properties-common > /dev/null

install_docker_ce() {
	echo "installing docker-ce"
	curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
	sudo add-apt-repository \
		"deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"
	sudo apt-get -qq update
	sudo apt-get -qq install -y docker-ce
	sudo usermod -aG docker ubuntu
	sudo systemctl restart docker
}

install_nodejs() {
	# curl -sL https://deb.nodesource.com/setup_8.x | sudo bash -
	sudo apt-get -qq install -y nodejs > /dev/null
	sudo apt-get -qq install -y npm > /dev/null
	echo "node version: $(node -v)"
	echo "npm version: $(npm -v)"

	sudo npm install -y -g n
	sudo n v8.13.0
	# sudo npm rebuild
	sudo apt-get purge -y nodejs
	sudo apt-get autoremove -y
}

# TODO: do this only when docker-ce is not installed yet
install_docker_ce

install_nodejs

newgrp docker

echo "installing awscli"
sudo -H pip3 install awscli --upgrade --quiet

echo "installing latest docker-composer"
sudo -H pip3 install docker-compose --upgrade --quiet

if ! docker-compose version > /dev/null ; then
	echo "no docker-compose"
	exit 1
fi

if ! go version ; then
	echo "installing golang"
	if [ ! -s go1.11.1.linux-amd64.tar.gz ] ; then
		wget -q https://dl.google.com/go/go1.11.1.linux-amd64.tar.gz
	fi
	sudo tar -C /usr/local -xzf go1.11.1.linux-amd64.tar.gz
	cat <<EOF >> /home/ubuntu/.bashrc
export GOPATH=/home/ubuntu/workspace/go
export PATH=\$PATH:/usr/local/go/bin
EOF
fi

. /home/ubuntu/.bashrc

mkdir -p $GOPATH/src/github.com/hyperledger/
if [ ! -d $GOPATH/src/github.com/hyperledger/fabric ] ; then
	git clone https://github.com/hyperledger/fabric $GOPATH/src/github.com/hyperledger/fabric
fi
if [ ! -d $GOPATH/src/github.com/hyperledger/fabric-ca ] ; then
	git clone https://github.com/hyperledger/fabric-ca $GOPATH/src/github.com/hyperledger/fabric-ca
fi
if [ ! -d $GOPATH/src/github.com/hyperledger/fabric-sdk-node ] ; then
	git clone https://github.com/hyperledger/fabric-sdk-node $GOPATH/src/github.com/hyperledger/fabric-sdk-node
fi
