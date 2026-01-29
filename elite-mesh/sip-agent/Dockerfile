FROM debian:12

RUN apt update && apt install -y asterisk asterisk-pjsip curl jq

COPY asterisk/ /etc/asterisk/
COPY entrypoint.sh /
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
