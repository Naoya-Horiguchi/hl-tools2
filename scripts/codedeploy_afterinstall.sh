ln -sf /usr/bin/python3 /usr/bin/python

killall apt apt-get
rm -f /var/lib/dpkg/lock
apt-get -qq update
apt-get -qq install -y make jq gcc g++ python3-pip apt-transport-https ca-certificates curl software-properties-common default-jre > /dev/null

install_docker_ce() {
    echo "installing docker-ce"
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
    add-apt-repository \
        "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
$(lsb_release -cs) \
stable"
    apt-get -qq update
    apt-get -qq install -y docker-ce
    usermod -aG docker ubuntu
    systemctl restart docker
}

install_nodejs() {
    # curl -sL https://deb.nodesource.com/setup_8.x | bash -
    apt-get -qq install -y nodejs > /dev/null
    apt-get -qq install -y npm > /dev/null
    echo "node version: $(node -v)"
    echo "npm version: $(npm -v)"

    npm install -y -g n
    n v8.13.0
    # TODO: need this
    npm rebuild
    apt-get purge -y nodejs
    apt-get autoremove -y
}

# TODO: do this only when docker-ce is not installed yet
install_docker_ce

install_nodejs

newgrp docker

echo "installing awscli"
pip3 install awscli --upgrade --quiet

echo "installing latest docker-composer"
pip3 install docker-compose --upgrade --quiet

if ! docker-compose version > /dev/null ; then
    echo "no docker-compose"
    exit 1
fi

if ! go version ; then
    echo "installing golang"
    if [ ! -s go1.11.1.linux-amd64.tar.gz ] ; then
        wget -q https://dl.google.com/go/go1.11.1.linux-amd64.tar.gz
    fi
    tar -C /usr/local -xzf go1.11.1.linux-amd64.tar.gz
    cat <<EOF >> /home/ubuntu/.bashrc
export GOPATH=/home/release/go
export PATH=\$PATH:/usr/local/go/bin
EOF
fi
