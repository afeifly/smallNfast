import React, { Component } from 'react';

import Checkbox from '@mui/material/Checkbox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import FormControlLabel from '@mui/material/FormControlLabel';
// import { FormGroup, FormControlLabel } from '@mui/material/Form';

// import { withStyles } from '@mui/material/styles';
// import blue from '@mui/material/colors/blue';


// const styles = {
//   checked: {
//     color: blue[500],
//   }
// };



class ChannelItem extends Component {

  constructor() {
    super();
    this.state = {
      data: {},
      checked: false
    }
  }

  render() {
    const { data } = this.props;
    const type = this.getChannelType(data);
    return (
      <div className="CL-channel-item">
        <Checkbox style={{ padding: 4 }} checked={data.selected}
                  onChange={this.handleChange(data)}
                  color="primary"
                  icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                  checkedIcon={<CheckBoxIcon fontSize="small" />}
                  value={ data.name }
                />
          <span className="CL-item-label" data-type={ type }>{ data.name }</span>
      </div>
    );
  }


  getChannelType(d) {
    let type = d.name.toLowerCase();
    type = type.replace(' ', '_');
    if(type.indexOf('virtual') !== -1) {
      type = 'virtual';
    }else if(type.indexOf('voltage') !== -1) {
      type = 'voltage';
    }
    // else if(type.indexOf('power') !== -1) {
    //   type = 'power';
    // }

    return type;
  }

  handleChange = data => event => {
    data.selected = event.target.checked;
    data.visible = data.selected;
    this.setState({ checked: data.selected });

    this.props.change(data);
  };
}

export default ChannelItem;