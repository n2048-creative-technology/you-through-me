# you through me

## Art project 

Concept by `Kalli Ioumpa`
Coded by `Mauricio van der Maesen`



docker build  -t ytm:local .
docker rm -f ytm
docker run -d  --name ytm -p 8888:8000 ytm:local
docker logs -f ytm
