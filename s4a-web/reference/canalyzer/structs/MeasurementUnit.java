/*
 * MeasurementUnit.java
 *
 * Created on 2008年2月19日, 下午2:19
 *
 * To change this template, choose Tools | Template Manager
 * and open the template in the editor.
 */

package com.cs.canalyzer.structs;

/**
 *
 * @author wolf
 */
public class MeasurementUnit {
    
    /** Creates a new instance of MeasurementUnit */
    public MeasurementUnit() {
    }
    
    public static boolean IsCurrentUnit( String unit ) {
        if ( unit.compareTo( CURRENT_UNIT ) == 0 ) {
            return true;
        }
        
        return false;
    }
    
    public static boolean IsFlowRateUnit( String unit ) {
        for ( String flowUnit : FLOW_RATE_UNITS ) {
            if ( unit.compareTo( flowUnit ) == 0 )
                return true;
        }
        
        return false;
    }
    
    /** calculate the convertion ratio from given unit to m3/h
     */ 
    public static float RatioToM3PerHour( String unit ) {
        for ( int i = 0; i < FLOW_RATE_UNITS.length; i++ ) {
            if ( unit.compareTo( FLOW_RATE_UNITS[i] ) == 0 )
                return FLOW_UNIT_RATIO_TO_M3_PER_HOUR[i];
        }

        return 1;
    }
    
    /** calculate the convertion ratio from given unit to m3
     * take a flow rate unit as parameter
     */ 
    public static float RatioToM3BasedOnFlowUnit( String flowUnit ) {
        for ( int i = 0; i < FLOW_RATE_UNITS.length; i++ ) {
            if ( flowUnit.compareTo( FLOW_RATE_UNITS[i] ) == 0 )
                return CONSUMPTION_UNITS_RATIO_TO_M3[i];
        }

        return 1;
    }

    /** calculate the convertion ratio from given unit to m3
     * take a consumption unit as parameter
     */ 
    public static float RatioToM3BasedOnConsumptionUnit( String unit ) {
        for ( int i = 0; i < CONSUMPTION_UNITS.length; i++ ) {
            if ( unit.compareTo( CONSUMPTION_UNITS[i] ) == 0 )
                return CONSUMPTION_UNITS_RATIO_TO_M3[i];
        }

        return 1;
    }

    /** calculate the convertion ratio from given unit to how much it is 
     * for 1 hour. for example, taking 1 l/min, will return 60
     */ 
    public static float FlowUnitRatioToOneHour( String unit ) {
        for ( int i = 0; i < FLOW_RATE_UNITS.length; i++ ) {
            if ( unit.compareTo( FLOW_RATE_UNITS[i] ) == 0 )
                return FLOW_UNIT_RATIO_TO_1_HOUR[i];
        }

        return 1;
    }

    /** Get resolution of given flow unit.
     */ 
    public static int FlowUnitResolution( String unit ) {
        for ( int i = 0; i < FLOW_RATE_UNITS.length; i++ ) {
            if ( unit.compareTo( FLOW_RATE_UNITS[i] ) == 0 )
                return FLOW_RATE_UNIT_RESOLUTIONS[i];
        }

        return 0;
    }

    /** get corresponding consumption unit based on given flow unit
     */ 
    public static String GetConsumptionUnit( String flowUnit ) {
        for ( int i = 0; i < FLOW_RATE_UNITS.length; i++ ) {
            if ( flowUnit.compareTo( FLOW_RATE_UNITS[i] ) == 0 )
                return CONSUMPTION_UNITS[i];
        }        
        
        return "";
    }
    
    public static boolean IsDewpointUnit( String unit ) {
        for ( String dewpointUnit : DEWPOINT_UNITS ) {
            if ( unit.compareTo( dewpointUnit ) == 0 )
                return true;
        }
        
        return false;
    }
    
    public static boolean IsPressureUnit( String unit ) {
        for ( String pressuretUnit : PRESSURE_UNITS ) {
            if ( unit.compareTo( pressuretUnit ) == 0 )
                return true;
        }
        
        return false;
    }
    
    /** calculate the convertion ratio from given unit to m3/h
     * 
    public static float RatioToM3PerHour( String unit ) {
        for ( int i = 0; i < FLOW_RATE_UNITS.length; i++ ) {
            if ( unit.compareTo( FLOW_RATE_UNITS[i] ) == 0 )
                return FLOW_UNIT_RATIO_TO_M3_PER_HOUR[i];
        }

        return 1;
    }*/

    
    public final static String CURRENT_UNIT = "A";
    //public static final String UNIT_PRESSURE = "bar";

    public final static char CUBIC_ASCII = 179;
    public final static String[] FLOW_RATE_UNITS = { 
        "m" + CUBIC_ASCII + "/h", // \u00B3/h" ,  /* m3/h 14*/
        "m" + CUBIC_ASCII + "/min", // \u00B3/min" , /* m3/min 15*/
        "l/min" ,       /* l/min 16*/
        "l/s" ,         /* l/s 17*/
        "cfm" ,         /* cfm 18*/
    };
    public final static int[] FLOW_RATE_UNIT_RESOLUTIONS = { 
        1, // \u00B3/h" ,  /* m3/h 14*/
        2, // \u00B3/min" , /* m3/min 15*/
        1,       /* l/min 16*/
        1,         /* l/s 17*/
        1,         /* cfm 18*/
    };  // need to match the order of FLOW_RATE_UNITS array
    public final static float[] FLOW_UNIT_RATIO_TO_M3_PER_HOUR = {
        1,  /* m3/h 14*/
        60, /* m3/min 15*/
        60 / 1000f,       /* l/min 16*/
        3600 / 1000f,         /* l/s 17*/
        60 * 0.0283f         /* cfm 18*/
    };  // need to match the order of FLOW_RATE_UNITS array
    public final static float[] FLOW_UNIT_RATIO_TO_1_HOUR = {
        1,  /* m3/h 14*/
        60, /* m3/min 15*/
        60,       /* l/min 16*/
        3600,         /* l/s 17*/
        60         /* cfm 18*/
    };  // need to match the order of FLOW_RATE_UNITS array, this is for consumption calculation
    public final static String[] CONSUMPTION_UNITS = { 
        "m" + CUBIC_ASCII,
        "m" + CUBIC_ASCII,
        "l",
        "l",
        "cf"
    };  // need to match the order of FLOW_RATE_UNITS array
    public final static float[] CONSUMPTION_UNITS_RATIO_TO_M3 = {
        1,  /* m3/h 14*/
        1, /* m3/min 15*/
        1 / 1000f,       /* l/min 16*/
        1 / 1000f,         /* l/s 17*/
        1 / (float) 0.0283         /* cfm 18*/
    };  // need to match the order of CONSUMPTION_UNITS array
    

    public final static char DEGREE_ASCII = 176;
    public final static String[] DEWPOINT_UNITS = { 
        DEGREE_ASCII + "Ctd", // \u00B0Ctd" ,    /* 4 */
        DEGREE_ASCII + "Ftd", // \u00B0Ftd" ,    /* 5 */
        "g/m" + CUBIC_ASCII, // \u00B3" ,    /* g/m3 9*/
        "mg/m" + CUBIC_ASCII, // \u00B3" ,   /* mg/m3 7*/
        "g/Kg" ,       /* g/kg 8*/
        "ppm[v]" ,         /* ppm 30*/
        DEGREE_ASCII + "Ctd atm", // \u00B0Ctd atm" ,    /* 31 */
        DEGREE_ASCII + "Ftd atm", // \u00B0Ftd atm"      /* 32 */
    };
    public final static String[] PRESSURE_UNITS = { 
        "bar", // \u00B0Ctd" ,    /* 4 */
    };
    
    
    public final static String[] UNIT_STRING = {
        "" ,           /* unit zero 0, used as custom unit as well */  
        DEGREE_ASCII + "C", // \u00B0C" ,      /* 1 */
        DEGREE_ASCII + "F", // \u00B0F" ,      /* 2 */
        "%" ,          /* percent 3*/
        DEGREE_ASCII + "Ctd", // \u00B0Ctd" ,    /* 4 */
        DEGREE_ASCII + "Ftd", // \u00B0Ftd" ,    /* 5 */
        "mg/Kg" ,      /* mg/kg 6*/
        "mg/m" + CUBIC_ASCII, // \u00B3" ,   /* mg/m3 7*/
        "g/Kg" ,       /* g/kg 8*/
        "g/m" + CUBIC_ASCII, // \u00B3" ,    /* g/m3 9*/
        "m/s" ,        /* m/s 10*/
        "ft/min" ,     /* ft/min 11*/
        "m/s" ,        /* m/s 12*/
        "ft/min" ,     /* ft/min 13*/
        "m" + CUBIC_ASCII + "/h", // \u00B3/h" ,  /* m3/h 14*/
        "m" + CUBIC_ASCII + "/min", // \u00B3/min" , /* m3/min 15*/
        "l/min" ,       /* l/min 16*/
        "l/s" ,         /* l/s 17*/
        "cfm" ,         /* cfm 18*/
        "m" + CUBIC_ASCII + "/h", // \u00B3/h" ,   /* m3/h 19*/
        "m" + CUBIC_ASCII + "/min", // \u00B3/min" , /* m3/min 20*/
        "l/min" ,       /* l/min 21*/
        "l/s" ,         /* l/s 22*/
        "cfm" ,         /* cfm 23*/
        "m" + CUBIC_ASCII, // \u00B3" ,       /* m3 24*/
        "l" ,           /* l 25*/
        "cf" ,          /* cf 26*/
        "m" + CUBIC_ASCII, // \u00B3" ,       /* m3 27*/
        "l" ,           /* l 28*/
        "cf" ,          /* cf 29*/
        "ppm[v]" ,         /* ppm 30*/
        DEGREE_ASCII + "Ctd atm", // \u00B0Ctd atm" ,    /* 31 */
        DEGREE_ASCII + "Ftd atm", // \u00B0Ftd atm"      /* 32 */
        "Pa" , //        "mA", // 0...20mA  /* 33 */
        "hPa" , //         "V",  // 0...10V  /* 34 */
        "KPa" , /* 35 */
        "MPa" , /* 36 */
        "mbar" , /* 37 */
        "bar" , /* 38 */
        " " , /* 39 */
        "mV" , /* 40 */
        "V" , /* 41 */
        "uV" , /* 42 */
        "KV" , /* 43 */
        "mA" , /* 44 */
        "A" , /* 45 */
        "kg/s", // #defin1e UNIT_N_KG_S              46
        "kg", // #define UNIT_N_KG                47
        "m" + CUBIC_ASCII + "/h av", // #define UNIT_N_AV_M3_H           48
        "l/h av", // #define UNIT_N_AV_L_H            49
        "kg/h av", // #define UNIT_N_AV_KG_H           50
        "cf/h av", // #define UNIT_N_AV_CF_H           51
        "kg/h", // #define UNIT_N_KG_H              52
        "kg/min" // #define UNIT_N_KG_MIN            53
    } ;
    /** gets index of the unit. returns 0 if not found ( custom unit )
     */
    public static int getUnitIndex( String unit ) {
        for ( int i = 0; i < UNIT_STRING.length; i++ ) {
            if ( unit.compareTo( UNIT_STRING[i] ) == 0 )
                return i;
        }
        
        return 0;
    }
    
    // if data type is short, need this to get final result after the decimal point assigned
    public final static int[] UNIT_RESOLUTION = {
        1, // "" ,           /* unit zero 0*/
        1, // DEGREE_ASCII + "C", // \u00B0C" ,      /* 1 */
        1, // DEGREE_ASCII + "F", // \u00B0F" ,      /* 2 */
        1, // "%" ,          /* percent 3*/
        1, // DEGREE_ASCII + "Ctd", // \u00B0Ctd" ,    /* 4 */
        1, // DEGREE_ASCII + "Ftd", // \u00B0Ftd" ,    /* 5 */
        0, // "mg/Kg" ,      /* mg/kg 6*/
        0, // "mg/m" + CUBIC_ASCII, // \u00B3" ,   /* mg/m3 7*/
        1, // "g/Kg" ,       /* g/kg 8*/
        1, // "g/m" + CUBIC_ASCII, // \u00B3" ,    /* g/m3 9*/
        1, // "m/s" ,        /* m/s 10*/
        0, // "ft/min" ,     /* ft/min 11*/
        1, // "m/s" ,        /* m/s 12*/
        0, // "ft/min" ,     /* ft/min 13*/
        0, // "m" + CUBIC_ASCII + "/h", // \u00B3/h" ,  /* m3/h 14*/
        1, // "m" + CUBIC_ASCII + "/min", // \u00B3/min" , /* m3/min 15*/
        1, // "l/min" ,       /* l/min 16*/
        1, // "l/s" ,         /* l/s 17*/
        1, // "cfm" ,         /* cfm 18*/
        0, // "m" + CUBIC_ASCII + "/h", // \u00B3/h" ,   /* m3/h 19*/
        1, // "m" + CUBIC_ASCII + "/min", // \u00B3/min" , /* m3/min 20*/
        1, // "l/min" ,       /* l/min 21*/
        1, // "l/s" ,         /* l/s 22*/
        1, // "cfm" ,         /* cfm 23*/
        0, // "m" + CUBIC_ASCII, // \u00B3" ,       /* m3 24*/
        0, // "l" ,           /* l 25*/
        0, // "cf" ,          /* cf 26*/
        0, // "m" + CUBIC_ASCII, // \u00B3" ,       /* m3 27*/
        0, // "l" ,           /* l 28*/
        0, // "cf" ,          /* cf 29*/
        0, // "ppm[v]" ,         /* ppm 30*/
        1, // DEGREE_ASCII + "Ctd atm", // \u00B0Ctd atm" ,    /* 31 */
        1, // DEGREE_ASCII + "Ftd atm", // \u00B0Ftd atm"      /* 32 */
        1, // "Pa",  was: 3, // "mA", // 0...20mA  /* 33 */
        1, // "hPa",  was: 3, // "V"  // 0...10V  /* 34 */
        1, /* 35 	        "KPa" , /* 35 */
        1, /* 36 	        "MPa" , /* 36 */
        1, /* 37 	        "mbar" , /* 37 */
        2, // "bar" /* 38 	        "bar" , /* 38 */
        1, /* 39 	        " " , /* 39 */
        1, /* 40	        "mV" , /* 40 */
        1, /* 41 	        "V" , /* 41 */
        1, /* 42 	        "uV" , /* 42 */
        1, /* 43 	        "KV" , /* 43 */
        1, /* 44 	        "mA" , /* 44 */
        1, // "A" /* 45 */
        3, // "kg/s", // #defin1e UNIT_N_KG_S              46
        0, // "kg", // #define UNIT_N_KG                47
        1, // "m" + CUBIC_ASCII + "/h av", // #define UNIT_N_AV_M3_H           48
        1, // "l/h av", // #define UNIT_N_AV_L_H            49
        1, // "kg/h av", // #define UNIT_N_AV_KG_H           50
        1, // "cf/h av", // #define UNIT_N_AV_CF_H           51
        1, // "kg/h", // #define UNIT_N_KG_H              52
        2, // "kg/min" // #define UNIT_N_KG_MIN            53
    } ;
    public static int getUnitResolution( String unit ) {
        return UNIT_RESOLUTION[getUnitIndex( unit )];
    }
    
    
     //added on 20130510,be ------------- begin
    public final static String[] ENERGY_UNITS = {       
        "kWh",
        "kvarh"       
    };
    
    public final static String[] POWER_UNITS = {"kW"};
    
    public static boolean IsEnergyUnit( String unit ) {
    	if(unit == null){
    		return false;
    	}
    	if("".equals(unit.trim())){
    		return false;
    	}
        for ( String energyUnit : ENERGY_UNITS ) {
            if ( unit.compareTo( energyUnit ) == 0 )
                return true;
        }
        
        return false;
    }
    
  
    
    public static boolean IsPowerUnit( String unit ) {
    	if(unit == null){
    		return false;
    	}
    	if("".equals(unit.trim())){
    		return false;
    	}
        for ( String energyUnit : POWER_UNITS ) {
            if ( unit.compareTo( energyUnit ) == 0 )
                return true;
        }
        
        return false;
    }
    //added on 20130510,be ------------- end
    
}
