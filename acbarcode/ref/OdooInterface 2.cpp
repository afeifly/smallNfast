#include "stdafx.h"

#ifdef _ODOO_SUPPORT

#include "OdooInterface.h"


std::shared_ptr<OdooInterface> OdooInterface::m_instance_ptr = nullptr;

std::vector<std::string> split(const std::string& s, const std::string& delimiter) {
	std::vector<std::string> tokens;
	size_t start = 0;
	size_t end = s.find(delimiter);

	while (end != std::string::npos) {
		tokens.push_back(s.substr(start, end - start));
		start = end + delimiter.length();
		end = s.find(delimiter, start);
	}

	tokens.push_back(s.substr(start));
	return tokens;
}

OdooInterface::OdooInterface()
{
}


OdooInterface::~OdooInterface()
{

}

std::shared_ptr<OdooInterface> OdooInterface::GetInstance()
{
	if (m_instance_ptr == nullptr)
	{
		m_instance_ptr = std::shared_ptr<OdooInterface>(new OdooInterface);
	}
	return m_instance_ptr;
}

void OdooInterface::Init(std::string url, std::string db, std::string username, std::string password)
{
	m_url = url;
	m_db = db;
	m_username = username;
	m_password = password;
}

int OdooInterface::GetAuthenticateId()
{
	int uid = -1;
	try
	{
		xmlrpc_c::value result;
		string callrul = m_url + "/xmlrpc/2/common";
		string methodName = "authenticate";

		xmlrpc_c::paramList list;
		list.add(value_string(m_db));
		list.add(value_string(m_username));
		list.add(value_string(m_password));
		list.add(value_string(""));

		Client.call(callrul, methodName, list, &result);
		uid = xmlrpc_c::value_int(result);
	}
	catch (const std::exception const& e)
	{
		cerr << "Client threw error: " << e.what() << endl;
	}

	return uid;
}
void OdooInterface::ExecuteKw(int uid)
{
	try
	{
		string serialNo = "111";
		string callrul = m_url + "/xmlrpc/2/object";
		string methodName = "execute_kw";
		xmlrpc_c::paramList list1;
		list1.add(value_string(m_db));
		list1.add(value_int(uid));
		list1.add(value_string(m_password));
		list1.add(value_string("stock.lot"));
		list1.add(value_string("search"));

		xmlrpc_c::carray array1, array2, array3;
		array3.push_back(value_string("name"));
		array3.push_back(value_string("="));
		//array3.push_back(value_boolean(true));
		array3.push_back(value_string("1525 8625"));
		array2.push_back(value_array(array3));
		array1.push_back(value_array(array2));
		list1.add(value_array(array1));

		xmlrpc_c::value result;
		Client.call(callrul, methodName, list1, &result);

		carray array = value_array(result).vectorValueValue();
		for (auto& arr : array)
		{
			std::cout << "data:" << value_int(arr) << endl;
		}
	}
	catch (const std::exception const& e)
	{
		cerr << "Client threw error: " << e.what() << endl;
	}
	
}

int OdooInterface::GetStockLots(int uid, const string& serialNo)
{
	int lots = -1;
	try
	{
		string callrul = m_url + "/xmlrpc/2/object";
		string methodName = "execute_kw";
		xmlrpc_c::paramList list1;
		list1.add(value_string(m_db));
		list1.add(value_int(uid));
		list1.add(value_string(m_password));
		list1.add(value_string("stock.lot"));
		list1.add(value_string("search"));

		xmlrpc_c::carray array1, array2, array3;
		array3.push_back(value_string("name"));
		array3.push_back(value_string("="));
		array3.push_back(value_string(serialNo));
		array2.push_back(value_array(array3));
		array1.push_back(value_array(array2));
		list1.add(value_array(array1));

		xmlrpc_c::value result;
		Client.call(callrul, methodName, list1, &result);

		carray array = value_array(result).vectorValueValue();
		for (auto& arr : array)
		{
			std::cout << "data:" << value_int(arr) << endl;
			lots = xmlrpc_c::value_int(arr);
		}

		//string lot = xmlrpc_c::value_string(result);
		
	}
	catch (const std::exception const& e)
	{
		cerr << "Client threw error: " << e.what() << endl;
	}

	return lots;
}

int OdooInterface::GetProductionIds(int uid, int id)
{
	int prod = -1;
	try
	{
		string callrul = m_url + "/xmlrpc/2/object";
		string methodName = "execute_kw";
		xmlrpc_c::paramList list1;
		list1.add(value_string(m_db));
		list1.add(value_int(uid));
		list1.add(value_string(m_password));
		list1.add(value_string("mrp.production"));
		list1.add(value_string("search"));

		xmlrpc_c::carray array1, array2, array3;
		array3.push_back(value_string("serial_ids"));
		array3.push_back(value_string("="));
		array3.push_back(value_int(id));
		array2.push_back(value_array(array3));
		array1.push_back(value_array(array2));
		list1.add(value_array(array1));

		xmlrpc_c::value result;
		Client.call(callrul, methodName, list1, &result);

		carray array = value_array(result).vectorValueValue();
		for (auto& arr : array)
		{
			std::cout << "data:" << value_int(arr) << endl;
			prod = xmlrpc_c::value_int(arr);
		}

		//prod = xmlrpc_c::value_int(result);
	}
	catch (const std::exception const& e)
	{
		cerr << "Client threw error: " << e.what() << endl;
	}

	return prod;
}

string OdooInterface::ReadProductions(int uid, int id, const string& keyword)
{
	string strrtn = "";
	try
	{
		string callrul = m_url + "/xmlrpc/2/object";
		string methodName = "execute_kw";
		xmlrpc_c::paramList list1;
		list1.add(value_string(m_db));
		list1.add(value_int(uid));
		list1.add(value_string(m_password));
		list1.add(value_string("mrp.production"));
		list1.add(value_string("read"));
		xmlrpc_c::carray array1, array2;
		array1.push_back(value_int(id));
		list1.add(value_array(array1));
		array2.push_back(value_string("name"));
		array2.push_back(value_string(keyword));
		xmlrpc_c::cstruct strc1;
		strc1.insert({ "fields", value_array(array2) });
		list1.add(value_struct(strc1));

		xmlrpc_c::value result;
		Client.call(callrul, methodName, list1, &result);

		carray array = value_array(result).vectorValueValue();

		for (auto& arr : array)
		{
			//std::cout << "data:" << value_int(arr) << endl;
			cstruct mapp = xmlrpc_c::value_struct(arr);
			auto it = mapp.find(keyword);
			if (it != mapp.end())
			{
				//auto prods = it->second;
				if (keyword == "product_id")
				{
					auto prodid = it->second;
					carray array1 = value_array(prodid).vectorValueValue();
					if (array1.size() > 1)
					{
						string prods = value_string(array1[1]);
						return prods;
					}
				}
				else
				{
					string prods = value_string(it->second);
					std::cout << "data:" << prods << endl;
					return prods;
				}
			}
		}
	}
	catch (const std::exception const& e)
	{
		cerr << "Client threw error: " << e.what() << endl;
	}
	
	return strrtn;
}


map<string, string> OdooInterface::GetCodesBySN(const string& serialNo)
{
	string codes;
	map<string, string> map_pair_codes;
	int uid = GetAuthenticateId();
	if (uid == -1)
	{
		return map_pair_codes;
	}
	int lots = GetStockLots(uid, serialNo);
	if (lots == -1)
	{
		return map_pair_codes;
	}

	int prod = GetProductionIds(uid, lots);
	if (prod == -1)
	{
		return map_pair_codes;
	}
	codes = ReadProductions(uid, prod,"product_description_variants");

	vector<string> vctcodes;
	vctcodes = split(codes,"\n");
	
	if (vctcodes.size() > 0)
	{
		for (auto code : vctcodes)
		{
			if (code.find(":") != string::npos)
			{
				vector<string> vctcode;
				vctcode = split(code, ":");
				string sztemp = vctcode[1];
				sztemp.erase(0, sztemp.find_first_not_of(" \t"));
				map_pair_codes.insert(make_pair(vctcode[0], sztemp));
			}
		}

		codes = ReadProductions(uid, prod, "product_id");
		map_pair_codes.insert(make_pair("OrderNo", codes));
	}

	return map_pair_codes;
}

#endif

