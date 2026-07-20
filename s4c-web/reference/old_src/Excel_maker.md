```go
// ChannelListGetResponse represents the response structure for channel list API.
type ChannelListGetResponse struct {
	ApiName string          `json:"apiname"`
	Data    ChannelListData `json:"data"`
	Msg     string          `json:"msg"`
	Status  string          `json:"status"`
	Time    int64           `json:"time"`
}

// ChannelListData represents the data section of channel list response.
type ChannelListData struct {
	ClassChannel []ClassChannel `json:"classchannel"`
}

// ClassChannel represents a single channel with its sensor information and Modbus configuration.
type ClassChannel struct {
	ChannelCreateTime  string  `json:"ChannelCreateTime"`
	DValue             float64 `json:"DValue"`
	ErrorValue         float64 `json:"ErrorValue"`
	MBValueByteOrder   int     `json:"MBValueByteOrder"`
	MBValueLength      int     `json:"MBValueLength"`
	Maximum            float64 `json:"Maximum"`
	Minimum            float64 `json:"Minimum"`
	Resolution         int     `json:"Resolution"`
	SValue             string  `json:"SValue"`
	SensorCreateTime   string  `json:"SensorCreateTime"`
	SensorID           int     `json:"SensorID"`
	Show               bool    `json:"Show"`
	Status             int     `json:"Status"`
	Unitascii          string  `json:"Unitascii"`
	Unitindex          int     `json:"Unitindex"`
	ValueType          int     `json:"ValueType"`
	ChannelDescription string  `json:"channeldescription"`
	ChannelID          int     `json:"channelid"`
	DeviceID           int     `json:"deviceid"`
	Formula            string  `json:"formula"`
	Funcode            int     `json:"funcode"`
	HoldingRegAddr     int     `json:"holdingregaddr"`
	Location           string  `json:"location"`
	Logger             bool    `json:"logger"`
	MeaPoint           string  `json:"meapoint"`
	Rw                 int     `json:"rw"`
	SensorDescription  string  `json:"sensordescription"`
	UseErrorValue      bool    `json:"useErrorValue"`
	UseMinMax          bool    `json:"useMinMax"`
}

func ExportSlaveAddressFile(c *gin.Context) {
	// new an Excel file
	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			log.Println(err)
		}
	}()
	// Set document Creator and Created time
	err := f.SetDocProps(&excelize.DocProperties{
		Creator:        "S332",
		LastModifiedBy: "S332",
		Created:        time.Now().Format("2006-01-02 15:04:05"),
	})
	if err != nil {
		log.Println(err)
	}

	// Get slave basic information
	rs485BasicInfo := global.CommunicationConfig.RS485S0
	slaveSheetName := "Slave address"
	f.SetSheetName("Sheet1", slaveSheetName)
	// initialize the sheet1 title
	f.MergeCell(slaveSheetName, "A1", "I1")
	f.SetCellValue(slaveSheetName, "A1", "S332 holding register table")
	if err := handleSlaveAddressInExcel(f, slaveSheetName, rs485BasicInfo); err != nil {
		log.Println(err)
	}
	// set title style
	style, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold: true,
			Size: 15,
		},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
		},
	})
	if err != nil {
		log.Println(err)
	}
	f.SetCellStyle(slaveSheetName, "A1", "I1", style)
	f.SetRowHeight(slaveSheetName, 1, 30)

	// Get the slave address file
	// Query recorded files via MQTT
	requestTopic := global.Config.MQTTClient.Topics.MeasurementChannelList.GetRequest(global.SystemConfig.SerialNo)
	responseTopic := global.Config.MQTTClient.Topics.MeasurementChannelList.GetResponse(global.SystemConfig.SerialNo)

	ok := false
	done := make(chan struct{})

	var getData model.ChannelListGetResponse
	err = global.MQTTClient.SubscribeAndPublish(responseTopic, requestTopic, func(s string) {
		ok = true
		var data model.ChannelListGetResponse
		err := json.Unmarshal([]byte(s), &data)
		if err != nil {
			log.Println("Failed to unmarshal JSON", "error", err)
			close(done)
			return
		}

		getData = data

		// unsubscribe
		global.MQTTClient.Unsubscribe(responseTopic)
		close(done)
	})
	if err != nil {
		log.Printf("Failed to subscribe and publish:%v", err)
		close(done)
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  false,
			"code":    http.StatusInternalServerError,
			"message": "Failed to query channel list",
		})
		return
	}

	// Wait for response or timeout
	select {
	case <-done:
		// Response received
		log.Println("Response received from MQTT: Export Slave Address File")
	case <-time.After(3 * time.Second):
		if !ok {
			global.MQTTClient.Unsubscribe(responseTopic)
		}
		c.JSON(http.StatusRequestTimeout, gin.H{
			"status":  false,
			"code":    http.StatusRequestTimeout,
			"message": "Query channel list timeout",
		})
		return
	}

	if err := handleSlaveDataInExcel(f, slaveSheetName, getData); err != nil {
		log.Println(err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  false,
			"code":    http.StatusInternalServerError,
			"message": "Failed to generate Excel file",
		})
		return
	}

	// Generate filename with timestamp
	fileName := fmt.Sprintf("slave_address_%s_%s.xlsx", global.SystemConfig.SerialNo, time.Now().Format("20060102150405"))

	// Set response headers for file download
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Transfer-Encoding", "binary")
	c.Header("Content-Disposition", "attachment; filename="+fileName)
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

	// Write Excel file to response
	if err := f.Write(c.Writer); err != nil {
		log.Println("Failed to write Excel file:", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  false,
			"code":    http.StatusInternalServerError,
			"message": "Failed to export Excel file",
		})
		return
	}
}

func handleSlaveDataInExcel(f *excelize.File, targetSheet string, data model.ChannelListGetResponse) error {
	// Set header row values
	f.SetCellValue(targetSheet, "A13", "Measurement point")
	f.SetCellValue(targetSheet, "B13", "Sensor")
	f.SetCellValue(targetSheet, "C13", "Channel")
	f.SetCellValue(targetSheet, "D13", "Address")
	f.SetCellValue(targetSheet, "E13", "Data type")
	f.SetCellValue(targetSheet, "F13", "No. of byte")
	f.SetCellValue(targetSheet, "G13", "Unit")
	f.SetCellValue(targetSheet, "H13", "Resolution")
	f.SetCellValue(targetSheet, "I13", "Func code")

	// Set the style for the header row - light gray border and font, centered
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold:  true,
			Color: "999999",
			Size:  12,
		},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "left", Color: "CCCCCC", Style: 1},
			{Type: "top", Color: "CCCCCC", Style: 1},
			{Type: "right", Color: "CCCCCC", Style: 1},
			{Type: "bottom", Color: "CCCCCC", Style: 1},
		},
	})
	f.SetCellStyle(targetSheet, "A13", "I13", headerStyle)
	f.SetRowHeight(targetSheet, 13, 25)
	f.SetColWidth(targetSheet, "B", "I", 20)

	// Define data cell style - light gray border and font, centered
	dataStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Color: "999999",
			Size:  12,
		},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "left", Color: "CCCCCC", Style: 1},
			{Type: "top", Color: "CCCCCC", Style: 1},
			{Type: "right", Color: "CCCCCC", Style: 1},
			{Type: "bottom", Color: "CCCCCC", Style: 1},
		},
	})

	// Handle empty data case according to specification
	if len(data.Data.ClassChannel) == 0 {
		// Merge cells A14:I14 and display "No channels configured"
		f.MergeCell(targetSheet, "A14", "I14")
		f.SetCellValue(targetSheet, "A14", "No channels configured")

		// Apply empty data style: gray italic text, centered, 14pt font with border
		emptyStyle, _ := f.NewStyle(&excelize.Style{
			Font: &excelize.Font{
				Size:   14,
				Italic: true,
				Color:  "888888",
			},
			Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
			Border: []excelize.Border{
				{Type: "left", Color: "CCCCCC", Style: 1},
				{Type: "top", Color: "CCCCCC", Style: 1},
				{Type: "right", Color: "CCCCCC", Style: 1},
				{Type: "bottom", Color: "CCCCCC", Style: 1},
			},
		})
		f.SetCellStyle(targetSheet, "A14", "I14", emptyStyle)
		f.SetRowHeight(targetSheet, 14, 30)

		// Add info message below (without gray border)
		f.MergeCell(targetSheet, "A15", "I15")
		f.MergeCell(targetSheet, "A16", "I16")
		f.SetCellValue(targetSheet, "A16", "Info: Use this holding register table to read data from the S332 via Modbus/RTU or Modbus/TCP")
		return nil
	}

	meaLocHandler, err := model.ParseLocationConfig(global.Config.SystemPath.LocationConfigs)
	if err != nil {
		log.Println("parse location config error:", err)
	}

	offset := 14
	for i, channel := range data.Data.ClassChannel {
		row := i + 14
		location, meaPoint := meaLocHandler.FindLocationAndMeapointByChannel(channel.ChannelCreateTime)

		// Apply data style to all cells in this row
		for col := 0; col < 9; col++ {
			cell := fmt.Sprintf("%c%d", 'A'+col, row)
			f.SetCellStyle(targetSheet, cell, cell, dataStyle)
		}

		f.SetCellValue(targetSheet, fmt.Sprintf("A%d", row), fmt.Sprintf("%s/%s", meaPoint, location))
		f.SetCellValue(targetSheet, fmt.Sprintf("B%d", row), channel.SensorDescription)
		f.SetCellValue(targetSheet, fmt.Sprintf("C%d", row), channel.ChannelDescription)
		f.SetCellValue(targetSheet, fmt.Sprintf("D%d", row), channel.HoldingRegAddr)
		f.SetCellValue(targetSheet, fmt.Sprintf("E%d", row), utils.ReflectDataType(channel.ValueType))
		f.SetCellValue(targetSheet, fmt.Sprintf("F%d", row), 4)
		f.SetCellValue(targetSheet, fmt.Sprintf("G%d", row), channel.Unitascii)
		f.SetCellValue(targetSheet, fmt.Sprintf("H%d", row), utils.ReflectResolution(channel.Resolution))
		f.SetCellValue(targetSheet, fmt.Sprintf("I%d", row), channel.Funcode)

		offset += 1
	}

	if offset > 14 {
		// Info row without gray border
		f.MergeCell(targetSheet, fmt.Sprintf("A%d", offset), fmt.Sprintf("I%d", offset))
		f.MergeCell(targetSheet, fmt.Sprintf("A%d", offset+1), fmt.Sprintf("I%d", offset+1))
		f.SetCellValue(targetSheet, fmt.Sprintf("A%d", offset+1), "Info: Use this holding register table to read data from the S332 via Modbus/RTU or Modbus/TCP")
	}

	return nil
}
```