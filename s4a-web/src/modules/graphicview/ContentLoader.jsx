import React, { Component } from 'react';
import * as d3 from 'd3';
import Loading from '../../components/loading/Loading';
// import { CircularProgress } from '@material-ui/core';


class ContentLoader extends Component {
  constructor() {
    super();
    this.loadingRef = React.createRef();
  }
  
  render() {
    return(
      <div className="content-loader">
        <Loading ref={this.loadingRef}/>
      </div>
    );
  }

  show = () => {
    this.loadingRef.current.show();
    d3.select('.content-loader').attr('data-status', 'active');
  };

  hide = () => {
    this.loadingRef.current.hide();
    d3.select('.content-loader').attr('data-status', '');
  };
}

export default ContentLoader;