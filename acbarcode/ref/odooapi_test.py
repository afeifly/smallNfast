import xmlrpc.client

url = "https://xxxxxxxx.com.cn"
db = "Sxxxx07"
username = "xxxxxxxxxxx"
password = "xxxxxx"

common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common")

uid = common.authenticate(db, username, password, {})
if uid:
    print(f"Success connected, user:{uid}")
else:
    print("Connect failed, please check the database and username and password.")

models = xmlrpc.client.ServerProxy(f'{url}/xmlrpc/2/object')

input_serial = input("Pls input serial number: ").strip()

if not input_serial:
    print("No input, exit.")
    exit()

lot_ids = models.execute_kw(db, uid, password,
    'stock.lot', 'search',
    [[['name', '=', input_serial]]]
)

if not lot_ids:
    print("Can not find SN.")
    exit()

production_ids = models.execute_kw(db, uid, password,
    'mrp.production', 'search',
    [[['serial_ids', 'in', lot_ids]]]
)

if not production_ids:
    print("Can not find MO.")
    exit()

records = models.execute_kw(db, uid, password,
    'mrp.production', 'read',
    [production_ids], {'fields': ['name', 'product_description_variants']}
)

print("\nMO and SN as below:")
for rec in records:
    print(f"MO: {rec['name']} | Variants: {rec['product_description_variants']}")