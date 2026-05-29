/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.cs.canalyzer.gui;


public class JTableFields {

    //name
    private String name = "";
    //type
    private String type = "";

    //add on 20091222.
    //reason : Wolfgang Blessing,Michael Kromer.
    private String valid_record_time="";

    //load analyzes
    private String full_load_time = "";
    private String unload_time = "";
    private String stop_time = "";
    private String number_of_starts = "";
    private String number_of_load_unload_cycles = "";

    //energy
    private String full_load_energy = "0";
    private String unload_energy = "0";
    private String stop_energy = "0";
    private String total_energy_consumption = "0";
    private String specific_power = "0";

    //Costs , 22 line
    private String full_load_costs = "0";
    private String unload_costs = "0";
    private String stop_costs = "0";
    private String total_costs = "0";
    private String costs_per_m2 = "0";


    //Air delivery ;//29 line
    private String average_flow = "0";
    private String max_flow = "0";
    private String total_air_delivery = "0";

    // Leakage ;//34 line
    private String average_leakage = "0";
    private String total_leakage = "0";
    private String leakage_costs = "0";

    //co2 emission
    private String co2_emission = "0";
//    private String co2_emission_kg = "";

    //Cumulated for 8400 h;//42 line
    //load analyzes
    private String oneyear_full_load_time = "";
    private String oneyear_unload_time = "";
    private String oneyear_stop_time = "";
    private String oneyear_number_of_starts = "";
    private String oneyear_number_of_load_unload_cycles = "";

    //energy
    private String oneyear_full_load_energy = "0";
    private String oneyear_unload_energy = "0";
    private String oneyear_stop_energy = "0";
    private String oneyear_total_energy_consumption = "0";

    //Costs
    private String oneyear_full_load_costs = "0";
    private String oneyear_unload_costs = "0";
    private String oneyear_stop_costs = "0";
    private String oneyear_total_costs = "0";


    //Air delivery
    private String oneyear_total_air_delivery = "0";

    // Leakage
    private String oneyear_total_leakage = "0";
    private String oneyear_leakage_costs = "0";

    //co2 emission
    private String oneyear_co2_emission = "0";
//    private String oneyear_co2_emission_kg = "";

    /**
     * @return the oneyear_full_load_costs
     */
    public String getOneyear_full_load_costs() {
        return oneyear_full_load_costs;
    }

    /**
     * @param oneyear_full_load_costs the oneyear_full_load_costs to set
     */
    public void setOneyear_full_load_costs(String oneyear_full_load_costs) {
        if("NaN".equals(oneyear_full_load_costs)) oneyear_full_load_costs = "0";
        this.oneyear_full_load_costs = checkField(oneyear_full_load_costs);
    }

    /**
     * @return the full_load_time
     */
    public String getFull_load_time() {
        return full_load_time;
    }

    /**
     * @param full_load_time the full_load_time to set
     */
    public void setFull_load_time(String full_load_time) {
         if("NaN".equals(full_load_time)) full_load_time = "0";
        this.full_load_time = checkField(full_load_time);
    }

    /**
     * @return the unload_time
     */
    public String getUnload_time() {
        return unload_time;
    }

    /**
     * @param unload_time the unload_time to set
     */
    public void setUnload_time(String unload_time) {
        if("NaN".equals(unload_time)) unload_time = "0";
        this.unload_time = checkField(unload_time);
    }

    /**
     * @return the stop_time
     */
    public String getStop_time() {
        return stop_time;
    }

    /**
     * @param stop_time the stop_time to set
     */
    public void setStop_time(String stop_time) {
        if("NaN".equals(stop_time)) stop_time = "0";
        this.stop_time = checkField(stop_time);
    }

    /**
     * @return the number_of_starts
     */
    public String getNumber_of_starts() {
        return number_of_starts;
    }

    /**
     * @param number_of_starts the number_of_starts to set
     */
    public void setNumber_of_starts(String number_of_starts) {
        if("NaN".equals(number_of_starts)) number_of_starts = "0";
        this.number_of_starts = number_of_starts;
    }

    /**
     * @return the number_of_load_unload_cycles
     */
    public String getNumber_of_load_unload_cycles() {
        return number_of_load_unload_cycles;
    }

    /**
     * @param number_of_load_unload_cycles the number_of_load_unload_cycles to set
     */
    public void setNumber_of_load_unload_cycles(String number_of_load_unload_cycles) {
         if("NaN".equals(number_of_load_unload_cycles)) number_of_load_unload_cycles = "0";
        this.number_of_load_unload_cycles = number_of_load_unload_cycles;
    }

    /**
     * @return the full_load_energy
     */
    public String getFull_load_energy() {
        return full_load_energy;
    }

    /**
     * @param full_load_energy the full_load_energy to set
     */
    public void setFull_load_energy(String full_load_energy) {
        if("NaN".equals(full_load_energy)) full_load_energy = "0";
        this.full_load_energy = checkField(full_load_energy);
        //this.sum_full_load_energy = this.sum_full_load_energy + full_load_energy;
    }

    /**
     * @return the unload_energy
     */
    public String getUnload_energy() {
        return unload_energy;
    }

    /**
     * @param unload_energy the unload_energy to set
     */
    public void setUnload_energy(String unload_energy) {
        if("NaN".equals(unload_energy)) unload_energy = "0";
        this.unload_energy = checkField(unload_energy);
    }

    /**
     * @return the stop_energy
     */
    public String getStop_energy() {
        return stop_energy;
    }

    /**
     * @param stop_energy the stop_energy to set
     */
    public void setStop_energy(String stop_energy) {
        if("NaN".equals(stop_energy)) stop_energy = "0";
        this.stop_energy = checkField(stop_energy);
    }

    /**
     * @return the total_energy_consumption
     */
    public String getTotal_energy_consumption() {
        return total_energy_consumption;
    }

    /**
     * @param total_energy_consumption the total_energy_consumption to set
     */
    public void setTotal_energy_consumption(String total_energy_consumption) {
        if("NaN".equals(total_energy_consumption)) total_energy_consumption = "0";
        this.total_energy_consumption = checkField(total_energy_consumption);
    }

    /**
     * @return the specific_power
     */
    public String getSpecific_power() {
        return specific_power;
    }

    /**
     * @param specific_power the specific_power to set
     */
    public void setSpecific_power(String specific_power) {
        if("NaN".equals(specific_power)) specific_power = "0";
        this.specific_power = specific_power;
    }

    /**
     * @return the full_load_costs
     */
    public String getFull_load_costs() {
        return full_load_costs;
    }

    /**
     * @param full_load_costs the full_load_costs to set
     */
    public void setFull_load_costs(String full_load_costs) {
         if("NaN".equals(full_load_costs)) full_load_costs = "0";
        this.full_load_costs = checkField(full_load_costs);
    }

    /**
     * @return the unload_costs
     */
    public String getUnload_costs() {
        return unload_costs;
    }

    /**
     * @param unload_costs the unload_costs to set
     */
    public void setUnload_costs(String unload_costs) {
         if("NaN".equals(unload_costs)) unload_costs = "0";
        this.unload_costs = checkField(unload_costs);
    }

    /**
     * @return the stop_costs
     */
    public String getStop_costs() {
        return stop_costs;
    }

    /**
     * @param stop_costs the stop_costs to set
     */
    public void setStop_costs(String stop_costs) {
         if("NaN".equals(stop_costs)) stop_costs = "0";
        this.stop_costs = checkField(stop_costs);
    }

    /**
     * @return the total_costs
     */
    public String getTotal_costs() {
        return total_costs;
    }

    /**
     * @param total_costs the total_costs to set
     */
    public void setTotal_costs(String total_costs) {
         if("NaN".equals(total_costs)) total_costs = "0";
        this.total_costs = checkField(total_costs);
    }

    /**
     * @return the costs_per_m2
     */
    public String getCosts_per_m2() {
        return costs_per_m2;
    }

    /**
     * @param costs_per_m2 the costs_per_m2 to set
     */
    public void setCosts_per_m2(String costs_per_m2) {
        if("NaN".equals(costs_per_m2)) costs_per_m2 = "0";
        this.costs_per_m2 = checkField(costs_per_m2);
    }

    /**
     * @return the average_flow
     */
    public String getAverage_flow() {
        return average_flow;
    }

    /**
     * @param average_flow the average_flow to set
     */
    public void setAverage_flow(String average_flow) {
        if("NaN".equals(average_flow)) average_flow = "0";
        if(average_flow != null)
            average_flow = average_flow.split(" ")[0];
        this.average_flow = checkField(average_flow);
    }

    /**
     * @return the max_flow
     */
    public String getMax_flow() {
        return max_flow;
    }

    /**
     * @param max_flow the max_flow to set
     */
    public void setMax_flow(String max_flow) {
        if("NaN".equals(max_flow)) max_flow = "0";
        if(max_flow != null)
            max_flow = max_flow.split(" ")[0];
        this.max_flow = checkField(max_flow);
    }

    /**
     * @return the total_air_delivery
     */
    public String getTotal_air_delivery() {
        return total_air_delivery;
    }

    /**
     * @param total_air_delivery the total_air_delivery to set
     */
    public void setTotal_air_delivery(String total_air_delivery) {
        if("NaN".equals(total_air_delivery)) total_air_delivery = "0";
        if(total_air_delivery != null)
            total_air_delivery = total_air_delivery.split(" ")[0];
        this.total_air_delivery = checkField(total_air_delivery);
    }

    /**
     * @return the average_leakage
     */
    public String getAverage_leakage() {
        return average_leakage;
    }

    /**
     * @param average_leakage the average_leakage to set
     */
    public void setAverage_leakage(String average_leakage) {
//        if("NaN".equals(average_leakage)) average_leakage = "0";
//        if(average_leakage.isEmpty() || average_leakage == null ) average_leakage = "0";
//        System.out.println("average_leakage="+average_leakage);
        average_leakage = checkField(average_leakage);
        average_leakage = average_leakage.split(" ")[0];
        this.average_leakage = checkField(average_leakage);
    }

    /**
     * @return the total_leakage
     */
    public String getTotal_leakage() {
        return total_leakage;
    }

    /**
     * @param total_leakage the total_leakage to set
     */
    public void setTotal_leakage(String total_leakage) {
//         if("NaN".equals(total_leakage)) total_leakage = "0";
        this.total_leakage = checkField(total_leakage);
    }

    /**
     * @return the leakage_costs
     */
    public String getLeakage_costs() {
        return leakage_costs;
    }

    /**
     * @param leakage_costs the leakage_costs to set
     */
    public void setLeakage_costs(String leakage_costs) {
//        if("NaN".equals(leakage_costs)) leakage_costs = "0";
        this.leakage_costs = checkField(leakage_costs);
    }

    /**
     * @return the co2_emission
     */
    public String getCo2_emission() {
        return co2_emission;
    }

    /**
     * @param co2_emission the co2_emission to set
     */
    public void setCo2_emission(String co2_emission) {
         if("NaN".equals(co2_emission)) co2_emission = "0";
        this.co2_emission = checkField(co2_emission);
    }

//    /**
//     * @return the co2_emission_kg
//     */
//    public String getCo2_emission_kg() {
//        return co2_emission_kg;
//    }
//
//    /**
//     * @param co2_emission_kg the co2_emission_kg to set
//     */
//    public void setCo2_emission_kg(String co2_emission_kg) {
//        this.co2_emission_kg = co2_emission_kg;
//    }

    /**
     * @return the oneyear_full_load_time
     */
    public String getOneyear_full_load_time() {
        return oneyear_full_load_time;
    }

    /**
     * @param oneyear_full_load_time the oneyear_full_load_time to set
     */
    public void setOneyear_full_load_time(String oneyear_full_load_time) {
//        System.out.println("JTableFields/setOneyear_full_load_time oneyear_full_load_time.trim().substring(0, 3)="+oneyear_full_load_time.trim().substring(0, 3));
         if(oneyear_full_load_time != null)
            if(oneyear_full_load_time.length() > 3)
                if("NaN".equals(oneyear_full_load_time.trim().substring(0, 3))) oneyear_full_load_time = "0";
        this.oneyear_full_load_time = checkField(oneyear_full_load_time);
    }

    /**
     * @return the oneyear_unload_time
     */
    public String getOneyear_unload_time() {
        return oneyear_unload_time;
    }

    /**
     * @param oneyear_unload_time the oneyear_unload_time to set
     */
    public void setOneyear_unload_time(String oneyear_unload_time) {
        if(oneyear_unload_time != null)
            if(oneyear_unload_time.length() > 3)
                if("NaN".equals(oneyear_unload_time.trim().substring(0, 3))) oneyear_unload_time = "0";
        this.oneyear_unload_time = checkField(oneyear_unload_time);
    }

    /**
     * @return the oneyear_stop_time
     */
    public String getOneyear_stop_time() {
        return oneyear_stop_time;
    }

    /**
     * @param oneyear_stop_time the oneyear_stop_time to set
     */
    public void setOneyear_stop_time(String oneyear_stop_time) {
        if(oneyear_stop_time != null)
            if(oneyear_stop_time.length() > 3)
                if("NaN".equals(oneyear_stop_time.trim().substring(0, 3))) oneyear_stop_time = "0";
        this.oneyear_stop_time = checkField(oneyear_stop_time);
    }

    /**
     * @return the oneyear_number_of_starts
     */
    public String getOneyear_number_of_starts() {
        return oneyear_number_of_starts;
    }

    /**
     * @param oneyear_number_of_starts the oneyear_number_of_starts to set
     */
    public void setOneyear_number_of_starts(String oneyear_number_of_starts) {
        if("NaN".equals(oneyear_number_of_starts)) oneyear_number_of_starts = "0";
        this.oneyear_number_of_starts = oneyear_number_of_starts;
    }

    /**
     * @return the oneyear_number_of_load_unload_cycles
     */
    public String getOneyear_number_of_load_unload_cycles() {
        return oneyear_number_of_load_unload_cycles;
    }

    /**
     * @param oneyear_number_of_load_unload_cycles the oneyear_number_of_load_unload_cycles to set
     */
    public void setOneyear_number_of_load_unload_cycles(String oneyear_number_of_load_unload_cycles) {
       if("NaN".equals(oneyear_number_of_load_unload_cycles)) oneyear_number_of_load_unload_cycles = "0";
        this.oneyear_number_of_load_unload_cycles = oneyear_number_of_load_unload_cycles;
    }

    /**
     * @return the oneyear_full_load_energy
     */
    public String getOneyear_full_load_energy() {
        return oneyear_full_load_energy;
    }

    /**
     * @param oneyear_full_load_energy the oneyear_full_load_energy to set
     */
    public void setOneyear_full_load_energy(String oneyear_full_load_energy) {
        if("NaN".equals(oneyear_full_load_energy)) oneyear_full_load_energy = "0";
        this.oneyear_full_load_energy = checkField(oneyear_full_load_energy);
    }

    /**
     * @return the oneyear_unload_energy
     */
    public String getOneyear_unload_energy() {
        return oneyear_unload_energy;
    }

    /**
     * @param oneyear_unload_energy the oneyear_unload_energy to set
     */
    public void setOneyear_unload_energy(String oneyear_unload_energy) {
         if("NaN".equals(oneyear_unload_energy)) oneyear_unload_energy = "0";
        this.oneyear_unload_energy = checkField(oneyear_unload_energy);
    }

    /**
     * @return the oneyear_stop_energy
     */
    public String getOneyear_stop_energy() {
        return oneyear_stop_energy;
    }

    /**
     * @param oneyear_stop_energy the oneyear_stop_energy to set
     */
    public void setOneyear_stop_energy(String oneyear_stop_energy) {
         if("NaN".equals(oneyear_stop_energy)) oneyear_stop_energy = "0";
        this.oneyear_stop_energy = checkField(oneyear_stop_energy);
    }

    /**
     * @return the oneyear_total_energy_consumption
     */
    public String getOneyear_total_energy_consumption() {
        return oneyear_total_energy_consumption;
    }

    /**
     * @param oneyear_total_energy_consumption the oneyear_total_energy_consumption to set
     */
    public void setOneyear_total_energy_consumption(String oneyear_total_energy_consumption) {
       if("NaN".equals(oneyear_total_energy_consumption)) oneyear_total_energy_consumption = "0";
        this.oneyear_total_energy_consumption = checkField(oneyear_total_energy_consumption);
    }

    /**
     * @return the oneyear_unload_costs
     */
    public String getOneyear_unload_costs() {
        return oneyear_unload_costs;
    }

    /**
     * @param oneyear_unload_costs the oneyear_unload_costs to set
     */
    public void setOneyear_unload_costs(String oneyear_unload_costs) {
         if("NaN".equals(oneyear_unload_costs)) oneyear_unload_costs = "0";
        this.oneyear_unload_costs = checkField(oneyear_unload_costs);
    }

    /**
     * @return the oneyear_stop_costs
     */
    public String getOneyear_stop_costs() {
        return oneyear_stop_costs;
    }

    /**
     * @param oneyear_stop_costs the oneyear_stop_costs to set
     */
    public void setOneyear_stop_costs(String oneyear_stop_costs) {
        if("NaN".equals(oneyear_stop_costs)) oneyear_stop_costs = "0";
        this.oneyear_stop_costs = checkField(oneyear_stop_costs);
    }

    /**
     * @return the oneyear_total_costs
     */
    public String getOneyear_total_costs() {
        return oneyear_total_costs;
    }

    /**
     * @param oneyear_total_costs the oneyear_total_costs to set
     */
    public void setOneyear_total_costs(String oneyear_total_costs) {
         if("NaN".equals(oneyear_total_costs)) oneyear_total_costs = "0";
        this.oneyear_total_costs = checkField(oneyear_total_costs);
    }

    /**
     * @return the oneyear_total_air_delivery
     */
    public String getOneyear_total_air_delivery() {
        return oneyear_total_air_delivery;
    }

    /**
     * @param oneyear_total_air_delivery the oneyear_total_air_delivery to set
     */
    public void setOneyear_total_air_delivery(String oneyear_total_air_delivery) {
//         if("NaN".equals(oneyear_total_air_delivery)) oneyear_total_air_delivery = "0";
        oneyear_total_air_delivery = checkField(oneyear_total_air_delivery);
        oneyear_total_air_delivery = oneyear_total_air_delivery.split(" ")[0];
        this.oneyear_total_air_delivery = checkField(oneyear_total_air_delivery);
    }

    /**
     * @return the oneyear_total_leakage
     */
    public String getOneyear_total_leakage() {
        return oneyear_total_leakage;
    }

    /**
     * @param oneyear_total_leakage the oneyear_total_leakage to set
     */
    public void setOneyear_total_leakage(String oneyear_total_leakage) {
//         if("NaN".equals(oneyear_total_leakage)) oneyear_total_leakage = "0";
        this.oneyear_total_leakage = checkField(oneyear_total_leakage);
    }

    /**
     * @return the oneyear_leakage_costs
     */
    public String getOneyear_leakage_costs() {
        return oneyear_leakage_costs;
    }

    /**
     * @param oneyear_leakage_costs the oneyear_leakage_costs to set
     */
    public void setOneyear_leakage_costs(String oneyear_leakage_costs) {
//        if("NaN".equals(oneyear_leakage_costs)) oneyear_leakage_costs = "0";
        this.oneyear_leakage_costs = checkField(oneyear_leakage_costs);
    }

    /**
     * @return the oneyear_co2_emission
     */
    public String getOneyear_co2_emission() {
        return oneyear_co2_emission;
    }

    /**
     * @param oneyear_co2_emission the oneyear_co2_emission to set
     */
    public void setOneyear_co2_emission(String oneyear_co2_emission) {
        if("NaN".equals(oneyear_co2_emission)) oneyear_co2_emission = "0";
        this.oneyear_co2_emission = checkField(oneyear_co2_emission);
    }

//    /**
//     * @return the oneyear_co2_emission_kg
//     */
//    public String getOneyear_co2_emission_kg() {
//        return oneyear_co2_emission_kg;
//    }
//
//    /**
//     * @param oneyear_co2_emission_kg the oneyear_co2_emission_kg to set
//     */
//    public void setOneyear_co2_emission_kg(String oneyear_co2_emission_kg) {
//        this.oneyear_co2_emission_kg = oneyear_co2_emission_kg;
//    }

    /**
     * @return the name
     */
    public String getName() {
        return name;
    }

    /**
     * @param name the name to set
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * @return the type
     */
    public String getType() {
        return type;
    }

    /**
     * @param type the type to set
     */
    public void setType(String type) {
        this.type = type;
    }

    private String checkField(String value){
        if("NaN".equals(value)) return "0";
        if(value.isEmpty() || value == null ) return "0";
        if(value != null ){
            if("".equals(value.trim()))
                return "0";
        }
        return value;
    }

    /**
     * @return the valid_record_time
     */
    public String getValid_record_time() {
        return valid_record_time;
    }

    /**
     * @param valid_record_time the valid_record_time to set
     */
    public void setValid_record_time(String valid_record_time) {
        this.valid_record_time = valid_record_time;
    }

}
