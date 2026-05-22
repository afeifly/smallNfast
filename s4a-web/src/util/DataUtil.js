import * as d3 from 'd3';

let DataUtil = {

  copy(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  getArrayFromTreeData(treeData) {
    const arr = [];

    if(!treeData) {
      return arr;
    }

    treeData.forEach(d => {
      this.fetchChildren(d, arr);
    });

    return arr;
  },


  fetchChildren(d, arr) {
    if(d) {
      arr.push(d);
    }

    if(d && d.children) {
      d.children.forEach(child => {
        this.fetchChildren(child, arr);
      })
    }
  },


  getChannlsFromTreeData(treeData) {
    const channels = [];
    const arr = this.getArrayFromTreeData(treeData);
    arr.forEach(d => {
      if(d && d.isChannel) {
        channels.push(d);
      }
    });

    return channels;
  },

  /**
   * Handle the data from API server
   * @param {JSON} channel
   * @param {JSON} resultData 
   * @param {Boolean} denoising 
   * @returns {Array} 
   */
  handleMeasurementData(channel, resultData) {
    const summaryData = [];
    if(!resultData) {
      return;
    }

    const realStartTime = resultData.realStartTime;
    const measurementData = resultData.measurementData;
    const pointInterval = resultData.pointInterval;

    let point;
    let time;
    let interval;
    let innerDataArray;
    let allNull = true;

    for (let i = 0; i < realStartTime.length; i++) {
      time = realStartTime[i];
      interval = pointInterval[i];
      innerDataArray = measurementData[i];

      if (!time || !interval || !innerDataArray || innerDataArray.length === 0) {
        continue;
      }
      
      for (let j = 0; j < innerDataArray.length; j++) {
        const value = innerDataArray[j];

        if(value !== null) {
          allNull = false;
        }

        point = {
          time: new Date(time - 3600000 * 8),
          value: value
        }

        summaryData.push(point);
        time += interval;

        //The end of inner array 
        //Create a point used for segment
        if (j === innerDataArray.length-1) {
          point = {
            time: new Date(time - 3600000 * 8),
            value: null
          }
  
          summaryData.push(point);
        }
      }
    }

    if(!allNull) {
      const min = d3.min(summaryData, d =>  d.value);
      const max = d3.max(summaryData, d =>  d.value);
      if(min > 0) {
        channel.minValue = Math.floor(min * 0.75);
      }else {
        channel.minValue = Math.floor(min);
      }
      channel.maxValue = Math.round(max * 1.25);
      channel.summaryData = null;
      channel.summaryData = summaryData;
    }else {
      channel.minValue = 0;
      channel.maxValue = 10;
      channel.summaryData = [];
    }

    if (channel.yAxisData) {
      let min = channel.yAxisData.scale.domain()[0];
      let max = channel.yAxisData.scale.domain()[1];

      if(channel.minValue < min) {
        min = channel.minValue;
      }

      if (channel.maxValue > max) {
        max = channel.maxValue;
      }
      channel.yAxisData.scale.domain([min, max]);
    }
  },


  appendNewData(channel, arr) {
    
  },


  /**
   * Handle the segment data
   * @param {Array} arr 
   */
  handleSegmentData(arr, denoising, timesPerPix) {
    const dataset = [];

    if(!arr) {
      return dataset;
    }

    let d;
    let innerArr;
    let tempDataset = [];
    for (let i = 0; i < arr.length; i++) {
      d = arr[i];
      if (d && d.value !== null) {
        if(!innerArr) {
          innerArr = [];
          tempDataset.push(innerArr);
        }
        innerArr.push(d);
      } else {
        innerArr = null;
      }      
    }

    let newInnerArr;
    for (let j = 0; j < tempDataset.length; j++) {
      innerArr = tempDataset[j];
      
      if (!innerArr && innerArr.length === 0) {
        continue;
      }

      if (denoising) {
        newInnerArr = this.denoising2(innerArr, timesPerPix);
        dataset.push(newInnerArr);
      } else {
        dataset.push(innerArr);
      }
    }
    return dataset;
  },


  denoising2(arr, timesPerPix) {
    if (!arr || arr.length === 1) {
      return [];
    }

    // if (arr.length < 10) {
    //   return arr;
    // }
    

    // timesPerPix = timesPerPix * 2;
    const newInnerArr = [];
    
    let d,
        time,
        min,
        max;

    for (let i = 0; i < arr.length; i++) {
      d = arr[i];

      if(!d) {
        continue;
      }

      if (!time) {
        time = d.time.getTime();
      }

      if((!min && min !== 0) || d.value < min) {
        min = d.value;
      }

      if((!max && max !== 0) || d.value > max) {
        max = d.value;
      }

      if(time <= d.time.getTime()) {
        if(d.value) {
          d.max = max;
          d.min = min;

          newInnerArr.push(d);
          min = null;
          max = null;
        }

        time += timesPerPix;
      }
    }

    return newInnerArr;
  },


  denoising(arr, timesPerPix) {
    if (!arr || arr.length === 1) {
      return [];
    }

    if (arr.length < 10) {
      return arr;
    }
    

    timesPerPix = timesPerPix * 2;
    const newInnerArr = [];
    
    let d;
    let time;
    
    for (let i = 0; i < arr.length; i++) {
      d = arr[i];
      if (!time) {
        time = d.time.getTime();
      }

      if(time <= d.time.getTime()) {
        if(d.value !== null) {
          newInnerArr.push(d);
        }
        time += timesPerPix;
      }
    }

    return newInnerArr;
  },


  // denoising(arr){
  //   if (!arr || arr.length === 1) {
  //     return [];
  //   }
  //   const pureDataArr = [];
    
  //   let d;
  //   for (let i = 0; i < arr.length; i++) {
  //     d = arr[i];
  //     if(d.value) {
  //       pureDataArr.push(d.value);
  //     }
  //   }
    
  //   const start = arr[0].time;
  //   const end = arr[arr.length - 1].time;
  //   let time;
  //   let dataObj;
  //   let newInnerArr = [];
  //   let newArr = this.doFilter(pureDataArr, 7);
  //   const step = (end.getTime() - start.getTime()) / newArr.length;
  //   for (let j = 0; j < newArr.length; j++) {
  //     if (j === 0) {
  //       time = new Date(start.getTime());
  //     }
  //     dataObj = {
  //       time: time,
  //       value: newArr[j]
  //     }


  //     newInnerArr.push(dataObj);
  //     time = new Date(time.getTime() + step);
  //   }

  //   return newInnerArr;
  // },


  doFilter(arr, N) {
    let newArr = [];
    let interceptedArr;
    let filteredArr = [];
    let arr1 = [];
    let arr2 = [];
    for(let i=0; i<arr.length; i+=N) {
      interceptedArr = arr.slice(i, i+N);
      filteredArr = [];
      this.linearSmooth5(interceptedArr, filteredArr, 5);

      filteredArr.forEach(d => {
        if(d) {
          arr1.push(d);
        }
      });
    }


    for(let i=0; i<arr1.length; i+=N) {
      interceptedArr = arr1.slice(i, i+N);
      filteredArr = [];
      this.quadraticSmooth5(interceptedArr, filteredArr, 5);

      filteredArr.forEach(d => {
        if(d) {
          arr2.push(d);
        }
      });
    }


    for(let i=0; i<arr2.length; i+=N) {
      interceptedArr = arr2.slice(i, i+N);
      filteredArr = [];
      this.cubicSmooth5(interceptedArr, filteredArr, 5);

      filteredArr.forEach(d => {
        if(d) {
          newArr.push(d);
        }
      });
    }

    return newArr;
  },


  linearSmooth3 (arr, pointNum) {
    const result = [];
    let i;
    if ( pointNum < 3 ){
      for ( i = 0; i <= pointNum - 1; i++ ){
        result[i] = arr[i];
      }
    }else {
      result[0] = ( 5.0 * arr[0] + 2.0 * arr[1] - arr[2] ) / 6.0;

        for ( i = 1; i <= pointNum - 2; i++ ) {
          result[i] = ( arr[i - 1] + arr[i] + arr[i + 1] ) / 3.0;
        }

        result[pointNum - 1] = ( 5.0 * arr[pointNum - 1] + 2.0 * arr[pointNum - 2] 
          - arr[pointNum - 3] ) / 6.0;
    }

    console.log(result);
    return result;
  },


  linearSmooth5(inArr, outArr, N) {
      let i;
      if ( N < 5 ) {
        for ( i = 0; i <= N - 1; i++ ) {
            outArr[i] = inArr[i];
        }
      }
      else {
        outArr[0] = ( 3.0 * inArr[0] + 2.0 * inArr[1] + inArr[2] - inArr[4] ) / 5.0;
        outArr[1] = ( 4.0 * inArr[0] + 3.0 * inArr[1] + 2 * inArr[2] + inArr[3] ) / 10.0;
        for ( i = 2; i <= N - 3; i++ ) {
          outArr[i] = ( inArr[i - 2] + inArr[i - 1] + inArr[i] + inArr[i + 1] + inArr[i + 2] ) / 5.0;
        }
        outArr[N - 2] = ( 4.0 * inArr[N - 1] + 3.0 * inArr[N - 2] + 2 * inArr[N - 3] + inArr[N - 4] ) / 10.0;
        outArr[N - 1] = ( 3.0 * inArr[N - 1] + 2.0 * inArr[N - 2] + inArr[N - 3] - inArr[N - 5] ) / 5.0;
      }
  },


  quadraticSmooth5(inArr, outArr, N) {
      let i;
      if ( N < 5 ) {
          for ( i = 0; i <= N - 1; i++ ) {
              outArr[i] = inArr[i];
          }
      }
      else {
        outArr[0] = ( 31.0 * inArr[0] + 9.0 * inArr[1] - 3.0 * inArr[2] - 5.0 * inArr[3] + 3.0 * inArr[4] ) / 35.0;
        outArr[1] = ( 9.0 * inArr[0] + 13.0 * inArr[1] + 12 * inArr[2] + 6.0 * inArr[3] - 5.0 *inArr[4]) / 35.0;
          for ( i = 2; i <= N - 3; i++ )
          {
            outArr[i] = ( - 3.0 * (inArr[i - 2] + inArr[i + 2]) +
                        12.0 * (inArr[i - 1] + inArr[i + 1]) + 17 * inArr[i] ) / 35.0;
          }
          outArr[N - 2] = ( 9.0 * inArr[N - 1] + 13.0 * inArr[N - 2] + 12.0 * inArr[N - 3] + 6.0 * inArr[N - 4] - 5.0 * inArr[N - 5] ) / 35.0;
          outArr[N - 1] = ( 31.0 * inArr[N - 1] + 9.0 * inArr[N - 2] - 3.0 * inArr[N - 3] - 5.0 * inArr[N - 4] + 3.0 * inArr[N - 5]) / 35.0;
      }
  },


  cubicSmooth5 (inArr, outArr, N)
  {
      let i;
      if ( N < 5 ) {
          for ( i = 0; i <= N - 1; i++ )
              outArr[i] = inArr[i];
      }
      else
      {
          outArr[0] = (69.0 * inArr[0] + 4.0 * inArr[1] - 6.0 * inArr[2] + 4.0 * inArr[3] - inArr[4]) / 70.0;
          outArr[1] = (2.0 * inArr[0] + 27.0 * inArr[1] + 12.0 * inArr[2] - 8.0 * inArr[3] + 2.0 * inArr[4]) / 35.0;
          for ( i = 2; i <= N - 3; i++ )
          {
            outArr[i] = (-3.0 * (inArr[i - 2] + inArr[i + 2])+ 12.0 * (inArr[i - 1] + inArr[i + 1]) + 17.0 * inArr[i] ) / 35.0;
          }
          outArr[N - 2] = (2.0 * inArr[N - 5] - 8.0 * inArr[N - 4] + 12.0 * inArr[N - 3] + 27.0 * inArr[N - 2] + 2.0 * inArr[N - 1]) / 35.0;
          outArr[N - 1] = (- inArr[N - 5] + 4.0 * inArr[N - 4] - 6.0 * inArr[N - 3] + 4.0 * inArr[N - 2] + 69.0 * inArr[N - 1]) / 70.0;
      }
  },


  randomString(len) {
    len = len || 32;
    let $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
    let maxPos = $chars.length;
    let result = '';
　　for (let i = 0; i < len; i++) {
      result += $chars.charAt(Math.floor(Math.random() * maxPos));
　　}
　　return result;
  }

};

export default DataUtil;