FROM debian:bookworm-slim

RUN apt-get update
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
RUN wget  https://raw.githubusercontent.com/acmesh-official/acme.sh/master/acme.sh
RUN chmod a+x acme.sh
RUN ./acme.sh --install --force
ADD issueCert.sh ./
RUN chmod a+x ./issueCert.sh

CMD ./issueCert.sh
