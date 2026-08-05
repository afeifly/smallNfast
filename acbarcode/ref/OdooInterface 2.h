#pragma once
#include <iostream>
#include <string>
#include "xmlrpc-c/base.hpp"
#include "xmlrpc-c/client_simple.hpp"

using namespace std;
using namespace xmlrpc_c;

class OdooInterface
{
private:
	static std::shared_ptr<OdooInterface> m_instance_ptr;
	int m_uid;
	std::string m_url;
	std::string m_db;
	std::string m_username;
	std::string m_password;
	xmlrpc_c::clientSimple Client;
private:

	OdooInterface();
	OdooInterface(const OdooInterface&) = delete;
	OdooInterface& operator=(const OdooInterface&) = delete;
public:
	static std::shared_ptr<OdooInterface> GetInstance();
	//{
	//	if (m_instance_ptr == nullptr)
	//	{
	//		m_instance_ptr = std::shared_ptr<OdooInterface>(new OdooInterface);
	//	}
	//	return m_instance_ptr;
	//}

	~OdooInterface();

	
	void ExecuteKw(int uid);//just test;
	void Init(std::string url, std::string db, std::string username, std::string password);
	map<string, string> GetCodesBySN(const string &serialNo);
	
private:
	
	int GetAuthenticateId();
	int GetStockLots(int uid,const string &serialNo);
	int GetProductionIds(int uid, int id);
	string ReadProductions(int uid, int id, const string& keyword);

};

//std::shared_ptr<OdooInterface> OdooInterface::m_instance_ptr = nullptr;

