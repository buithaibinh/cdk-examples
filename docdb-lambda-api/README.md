# Deploy stack

 * `cdk deploy`      deploy this stack to your default AWS account/region

# Download pem file

```
Since TLS is enabled by default, you will need a public key for interacting with DocumentDB instances.

https://docs.aws.amazon.com/documentdb/latest/developerguide/getting-started.connect.html

Download the key and put it inside src folder without changing the filename(rds-combined-ca-bundle.pem) or content.
```

* `wget https://s3.amazonaws.com/rds-downloads/rds-combined-ca-bundle.pem `
* `cdk deploy`      deploy this stack to your default AWS account/region

# Testing

Body:
```json
{
    "url": "https://vnexpress.net/thue-xe-cuu-thuong-de-thong-chot-kiem-dich-4332803.html"
}
```