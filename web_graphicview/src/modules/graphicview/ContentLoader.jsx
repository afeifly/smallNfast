import React, { Component } from 'react';
import * as d3 from 'd3';
import Loading from '../../components/loading/Loading';
// import { CircularProgress } from '@material-ui/core';


class ContentLoader extends Component {
  
  render() {
    return(
      <div className="content-loader">
        <Loading ref="loading"/>
      </div>
    );
  }

  show = () => {
    this.refs.loading.show();
    d3.select('.content-loader').attr('data-status', 'active');
  };

  hide = () => {
    this.refs.loading.hide();
    d3.select('.content-loader').attr('data-status', '');
  };
}

export default ContentLoader;