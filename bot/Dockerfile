FROM debian:buster-slim

RUN apt-get update
RUN apt-get install -y wget python python-pip
RUN pip install awscli
RUN wget  https://raw.githubusercontent.com/acmesh-official/acme.sh/master/acme.sh
RUN chmod a+x acme.sh
RUN ./acme.sh --install --force
ADD issueCert.sh ./
RUN chmod a+x ./issueCert.sh

CMD ./issueCert.sh
