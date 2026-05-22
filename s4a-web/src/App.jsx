import React from 'react';
import GraphicView from './modules/graphicview';
import './App.css';

import intl from 'react-intl-universal';
import locales from './locales/en-US';

function App() {
  const [initDone, setInitDone] = React.useState(false);

  React.useEffect(() => {
    if (!localStorage.getItem('username')) {
      localStorage.setItem('username', 'admin');
    }

    intl.init({
      currentLocale: 'en-US',
      locales: {
        'en-US': locales
      }
    }).then(() => {
      setInitDone(true);
    });
  }, []);

  if (!initDone) {
    return <div>Loading...</div>;
  }

  return (
    <div className="App" style={{ height: '100vh', width: '100vw' }}>
      <GraphicView />
    </div>
  );
}

export default App;
