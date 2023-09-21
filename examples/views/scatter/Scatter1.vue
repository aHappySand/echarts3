<template>
  <div class="fill">
    <Echarts3 :source-data="sourceData" v-if="isLoaded"></Echarts3>
  </div>
</template>

<script>
export default {
  name: 'Scatter1',
  data() {
    this.chartData = null;
    return {
      sourceData: [],
      isLoaded: false,
    };
  },
  created() {
    this.draw1();
  },
  methods: {
    getChartData() {
      console.clear();
      return fetch('/static/data/100000-16.json').then(response => {
        if (response.status === 200) {
          return response.json().then(data => {
            this.chartData = data;
          });
        }
      });
    },
    startRender() {
      const data = this.chartData.map((item, index) => [item.x, item.y, index]);
      console.log(data);
      this.sourceData = [{
        option: {
          grid: {
            top: 40
          },
          // dataZoom: {
          //   type: 'inside',
          // },
          xAxis: [{
            type: 'value',
            scale: true,
            splitLine: {
              show: false
            }
          }],
          yAxis: [{
            type: 'value',
            scale: true,
            splitLine: {
              show: false
            }
          }],
          series: [
            {
              type: 'scatter',
              data,
            }
          ]
        }
      }];
      this.isLoaded = true;
    },
    draw1() {
      const data = (new Array(200)).fill().map(() => [Math.random() * 1000, Math.random() * 1000]);
      this.sourceData = [{
        option: {
          grid: {
            top: 40
          },
          dataZoom: {
            type: 'inside',
          },
          xAxis: [{
            type: 'value',
            scale: true,
            splitLine: {
              show: false
            }
          }],
          yAxis: [{
            type: 'value',
            scale: true,
            splitLine: {
              show: false
            }
          }],
          series: [
            {
              type: 'scatter',
              data,
            }
          ]
        }
      }];
      this.isLoaded = true;
    },
    draw2() {
      var data1 = [];
      var data2 = [];
      var data3 = [];

      var random = function (max) {
        return (Math.random() * max).toFixed(3);
      };

      for (var i = 0; i < 100; i++) {
        data1.push([random(15), random(10), random(1)]);
        // data1.push([i, 10, i]);
        data2.push([random(10), random(10), random(1)]);
        data3.push([random(15), random(10), random(1)]);
      }

      this.sourceData = [{
        option: {
          animation: false,
          legend: {
            data: ['scatter', 'scatter2', 'scatter3']
          },
          toolbox: {
            show: true,
            feature: {
              brush: {
                type: ['rect', 'clear']
              },
              dataZoom: {
                yAxisIndex: 'none'
              },
              dataView: {
                readOnly: false
              },
              magicType: {
                type: ['line', 'bar']
              },
              restore: {},
              saveAsImage: {}
            }
          },
          tooltip: {
          },
          xAxis: {
            type: 'value',
            min: 'dataMin',
            max: 'dataMax',
            splitLine: {
              show: true
            }
          },
          yAxis: {
            type: 'value',
            min: 'dataMin',
            max: 'dataMax',
            splitLine: {
              show: true
            }
          },
          dataZoom: [
            {
              show: true,
              xAxisIndex: [0],
              start: 1,
              end: 5
            },
            {
              show: true,
              yAxisIndex: [0],
              start: 29,
              end: 36
            },

          ],
          series: [
            {
              name: 'scatter',
              type: 'scatter',
              itemStyle: {
                normal: {
                  opacity: 0.8,
                  // shadowBlur: 10,
                  // shadowOffsetX: 0,
                  // shadowOffsetY: 0,
                  // shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
              },
              // symbolSize(val) {
              //   return val[2] * 40;
              // },
              data: data1
            },
            {
              name: 'scatter2',
              type: 'scatter',
              itemStyle: {
                normal: {
                  opacity: 0.8
                }
              },
              // symbolSize(val) {
              //   return val[2] * 40;
              // },
              data: data2
            },
            {
              name: 'scatter3',
              type: 'scatter',
              itemStyle: {
                normal: {
                  opacity: 0.8,
                }
              },
              // symbolSize(val) {
              //   return val[2] * 40;
              // },
              data: data3
            }
          ]
        }
      }];
      this.isLoaded = true;
    },
    draw3() {
      this.getChartData().then(() => {
        this.startRender();
      });
    }
  }
};
</script>

<style scoped>

</style>
