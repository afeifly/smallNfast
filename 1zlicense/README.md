# 1zlicense

## Introduce 
>Easy implements for software get license 

## DB
easylicense.sql

## Run normal server
```
npm install
npm run build
node server.js
```

## Debug
```
# step 1 Add proxy property to package.json
  "proxy": "http://localhost:8082",
  
# step 2 run node at 3000
server.listen(process.env.PORT || 8082, process.env.IP || "0.0.0.0", function () {})
node server.js

# run react 
npm start

```


## build for docker
```
npm install
npm run build
docker build -t suto/1zlicense .
```

## Run on docker
docker-compose up -d

## Export sql from DB
```bash
# backup database sql
docker exec -it 1zlicense_licensedb_1 bash 
mysqldump -ulicenseuser -p --databases easylicense >/tmp/easylicense.sql  
# Get back to host
docker cp cpms_cpmsdb_1:/tmp/easylicense.sql easylicense.sql


```

## License RESTfull API
Post 
Url : /registration
with 
```json
{
"localid":"XXXX-XXXX-XXXX-XXXX",
"sn":"1111-1111-1111-1111",
"email":"test@test.com",
"company":"Test company",
"user":"Test",
"addr":"Custemer address",
"productid":6
}
```

## DB change history

### Add LMS
```
INSERT INTO `easylicense`.`software_products`(`id`, `name`) VALUES (4, 'LMS-cloud');
INSERT INTO `easylicense`.`sn_properties_define`(`id`, `product_id`, `property_name`, `display_name`, `property_type`, `scaling_min`, `scaling_max`, `default_value`) VALUES (3, 4, 'expire_years', NULL, 0, 0, 100, 1);
INSERT INTO `easylicense`.`sn_properties_define`(`id`, `product_id`, `property_name`, `display_name`, `property_type`, `scaling_min`, `scaling_max`, `default_value`) VALUES (4, 4, 'install_type', NULL, 0, 0, 100, 0);
INSERT INTO `easylicense`.`sn_properties_define`(`id`, `product_id`, `property_name`, `display_name`, `property_type`, `scaling_min`, `scaling_max`, `default_value`) VALUES (5, 4, 'max_users', NULL, 0, 0, 100, 1);
```

### Add new table for S520

```sql
CREATE TABLE `s520licenses` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `sn` varchar(45) NOT NULL DEFAULT '',
  `note` varchar(100) NOT NULL,
  `license` varchar(50) NOT NULL,
  `createdatetime` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=219 DEFAULT CHARSET=utf8
```

### Add new table for events record
```sql
CREATE TABLE `events` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `user` varchar(45) NOT NULL,
  `action` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `note` varchar(100) NOT NULL,
  `createdatetime` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=219 DEFAULT CHARSET=utf8
-- action 1: create 2: reset 3: delete
```

### Add new table for S4CUS
```sql
CREATE TABLE `s4cus_serialnumber` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `sn` varchar(45) NOT NULL DEFAULT '',
  `sntype` int(11) NOT NULL,
  `state` int(11) NOT NULL DEFAULT 0,
  `deviceid` varchar(45) NULL DEFAULT '',
  `company` varchar(100) NOT NULL,
  `note` varchar(100) NOT NULL,
  `createdatetime` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=219 DEFAULT CHARSET=utf8

-- sntype: 0 - service partner; 1 - calibration
-- state: 0 - init; 1 - active; 2 - block;

```

### Add new table for S4A remote
```sql
CREATE TABLE `s4a_remote_serialnumber` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `sn` varchar(45) NOT NULL DEFAULT '',
  `state` int(2) NOT NULL DEFAULT 0,
  `cn` int(2) NOT NULL DEFAULT 0,
  `hk` int(2) NOT NULL DEFAULT 0,
  `eu` int(2) NOT NULL DEFAULT 0,
  `op0` int(2) NOT NULL DEFAULT 0,
  `op1` int(2) NOT NULL DEFAULT 0,
  `op2` int(2) NOT NULL DEFAULT 0,
  `op3` int(2) NOT NULL DEFAULT 0,
  `op4` int(2) NOT NULL DEFAULT 0,
  `note` varchar(100) NOT NULL,
  `createdatetime` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=219 DEFAULT CHARSET=utf8

-- sntype: 0 - service partner; 1 - calibration
-- state: 0 - init; 1 - active; 2 - block;

```
### Add new table for calibration license

```sql
CREATE TABLE `calibrationlicenses` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `sn` varchar(45) NOT NULL DEFAULT '',
  `localid` varchar(45) NOT NULL DEFAULT '',
  `company` varchar(100) NOT NULL,
  `note` varchar(100) NOT NULL,
  `state` int(2) NOT NULL DEFAULT 0,
  `createdatetime` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=219 DEFAULT CHARSET=utf8

-- state: 0 - init; 1 - active; 2 - block;

```



## Run deploy
docker stack deploy --compose-file=license-stk.yml easylicense

## Maintain
### show license with product attribute

```sql
select s.sn,s.products_id,s.used,s.max,s.createdatetime,s.note,l.email,l.company,l.addr,l.text, p.canbereset
from serialnumbers s 
LEFT join licenses l 
on s.sn = l.sn 
LEFT JOIN software_products p
on s.products_id = p.id
```

## In Channing
- Add new product

```
INSERT INTO `easylicense`.`software_products`(`id`, `name`) VALUES (6, 'LMS');
```

- Add Create new product license Option in UI
- Add new product type supports in license list
- Hand new product regisration.

## Software install checking 
### Add new table for device install time checking
```sql
CREATE TABLE `device_usage_state` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `device_id` varchar(45) NOT NULL DEFAULT '',
  `product_id` int(11) NOT NULL DEFAULT 0,
  `firsttime` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=219 DEFAULT CHARSET=utf8
```

## Update table for some products don't need reset function

### Add canbereset field to software_products

```sql
 alter table software_products add canbereset int(2) default '1';
```

### Update Software products make sure LMS cannot be reset
```sql
update software_products set name = 'LMS-cloud' where id=4;
update software_products set name = 'LMS', canbereset=0 where id=6;
```

### Update table for S520 and S332 licenses
```sql
CREATE TABLE `s520licenses` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `sn` varchar(45) NOT NULL DEFAULT '',
  `note` text,
  `license` varchar(255) DEFAULT NULL,
  `createdatetime` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `s332licenses` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `machine_code` varchar(255) DEFAULT NULL,
  `note` text,
  `license` varchar(255) DEFAULT NULL,
  `createdatetime` datetime DEFAULT NULL,
  `create_by` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```

### Docker Database - Create New Table
To create a new table in the database while running in a Docker container (e.g. as part of a stack), you can use the `docker exec` command to run the MySQL client within the container.

Example for adding the S332 license table:
```bash
docker exec -it <db_container_name_or_id> mysql -u licenseuser -psutouser2019 easylicense -e "CREATE TABLE IF NOT EXISTS s332licenses (id INT AUTO_INCREMENT PRIMARY KEY, machine_code VARCHAR(255), note TEXT, license VARCHAR(255), createdatetime DATETIME, create_by VARCHAR(100));"
```

> [!NOTE]
> Replace `<db_container_name_or_id>` with your actual running DB container name (typically `easylicense_db.1.<id>` if using docker stack).

### Docker database import

```bash
docker exec -i 1zlicense-licensedb-1 mysql -u root -p'sid@ds.ci@Pd32' easylicense < easylicense_dump.sql
```

### Docker database cli

```bash
docker exec -it 1zlicense-licensedb-1 mysql -u root -p'sid@ds.ci@Pd32' easylicense
```
