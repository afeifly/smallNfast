import axios from 'axios';
import Cookies from 'js-cookie';
import * as Constant from '../common/Constant';

const fetchClient = () => {
  const defaultOptions = {
    baseURL: `/api/`,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Create instance
  let instance = axios.create(defaultOptions);

  // Set the AUTH token for any request
  instance.interceptors.request.use(function (config) {

    const token = Cookies.get(Constant.COOKIE_TOKEN);
    config.headers[Constant.COOKIE_TOKEN] =  token ? `${token}` : '';
    return config;
  });

  return instance;
};

export default fetchClient();