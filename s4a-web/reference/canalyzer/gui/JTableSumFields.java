/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.cs.canalyzer.gui;

public class JTableSumFields {
    //sum of all compressors =======begin
    //add on 20091223.
    //reason : Wolfgang Blessing,Michael Kromer.
    private double sum_valid_record_time=0;

     //load analyzes
    private String sum_full_load_time = "";
    private String sum_unload_time = "";
    private String sum_stop_time = "";
    private String sum_number_of_starts = "";
    private String sum_number_of_load_unload_cycles = "";

    //energy
    private double sum_full_load_energy = 0;
    private double sum_unload_energy = 0;
    private double sum_stop_energy = 0;
    private double sum_total_energy_consumption = 0;
    private double sum_specific_power = 0;

    //Costs , 22 line
    private double sum_full_load_costs = 0;
    private double sum_unload_costs = 0;
    private double sum_stop_costs = 0;
    private double sum_total_costs = 0;
    private double sum_costs_per_m2 = 0;


    //Air delivery ;//29 line
    private double sum_average_flow = 0;
    private double sum_max_flow = 0;
    private double sum_total_air_delivery = 0;

    // Leakage ;//34 line
    private double sum_average_leakage = 0;
    private double sum_total_leakage = 0;
    private double sum_leakage_costs = 0;

    //co2 emission
    private double sum_co2_emission = 0;
//    private String co2_emission_kg = "";

    //Cumulated for 8400 h;//42 line
    //load analyzes
    private String sum_oneyear_full_load_time = "";
    private String sum_oneyear_unload_time = "";
    private String sum_oneyear_stop_time = "";
    private String sum_oneyear_number_of_starts = "";
    private String sum_oneyear_number_of_load_unload_cycles = "";

    //energy
    private double sum_oneyear_full_load_energy = 0;
    private double sum_oneyear_unload_energy = 0;
    private double sum_oneyear_stop_energy = 0;
    private double sum_oneyear_total_energy_consumption = 0;

    //Costs
    private double sum_oneyear_full_load_costs = 0;
    private double sum_oneyear_unload_costs = 0;
    private double sum_oneyear_stop_costs = 0;
    private double sum_oneyear_total_costs = 0;


    //Air delivery
    private double sum_oneyear_total_air_delivery = 0;

    // Leakage
    private double sum_oneyear_total_leakage = 0;
    private double sum_oneyear_leakage_costs = 0;

    //co2 emission
    private double sum_oneyear_co2_emission = 0;

    //unit , add 20091014.
    private String costs_unit;
    private String specific_power_unit;
    private String air_delivery_unit;

    //valid record time
    private double valid_record_time = 0;
    /**
     * @return the sum_full_load_time
     */
    public String getSum_full_load_time() {
        return sum_full_load_time;
    }

    /**
     * @param sum_full_load_time the sum_full_load_time to set
     */
    public void setSum_full_load_time(String sum_full_load_time) {
        this.sum_full_load_time = sum_full_load_time;
    }

    /**
     * @return the sum_unload_time
     */
    public String getSum_unload_time() {
        return sum_unload_time;
    }

    /**
     * @param sum_unload_time the sum_unload_time to set
     */
    public void setSum_unload_time(String sum_unload_time) {
        this.sum_unload_time = sum_unload_time;
    }

    /**
     * @return the sum_stop_time
     */
    public String getSum_stop_time() {
        return sum_stop_time;
    }

    /**
     * @param sum_stop_time the sum_stop_time to set
     */
    public void setSum_stop_time(String sum_stop_time) {
        this.sum_stop_time = sum_stop_time;
    }

    /**
     * @return the sum_number_of_starts
     */
    public String getSum_number_of_starts() {
        return sum_number_of_starts;
    }

    /**
     * @param sum_number_of_starts the sum_number_of_starts to set
     */
    public void setSum_number_of_starts(String sum_number_of_starts) {
        this.sum_number_of_starts = sum_number_of_starts;
    }

    /**
     * @return the sum_number_of_load_unload_cycles
     */
    public String getSum_number_of_load_unload_cycles() {
        return sum_number_of_load_unload_cycles;
    }

    /**
     * @param sum_number_of_load_unload_cycles the sum_number_of_load_unload_cycles to set
     */
    public void setSum_number_of_load_unload_cycles(String sum_number_of_load_unload_cycles) {
        this.sum_number_of_load_unload_cycles = sum_number_of_load_unload_cycles;
    }

    /**
     * @return the sum_full_load_energy
     */
    public double getSum_full_load_energy() {
        return sum_full_load_energy;
    }

    /**
     * @param sum_full_load_energy the sum_full_load_energy to set
     */
    public void setSum_full_load_energy(double sum_full_load_energy) {
        this.sum_full_load_energy = checkfield(sum_full_load_energy);
    }

    /**
     * @return the sum_unload_energy
     */
    public double getSum_unload_energy() {
        return sum_unload_energy;
    }

    /**
     * @param sum_unload_energy the sum_unload_energy to set
     */
    public void setSum_unload_energy(double sum_unload_energy) {
        this.sum_unload_energy = checkfield(sum_unload_energy);
    }

    /**
     * @return the sum_stop_energy
     */
    public double getSum_stop_energy() {
        return sum_stop_energy;
    }

    /**
     * @param sum_stop_energy the sum_stop_energy to set
     */
    public void setSum_stop_energy(double sum_stop_energy) {
        this.sum_stop_energy = checkfield(sum_stop_energy);
    }

    /**
     * @return the sum_total_energy_consumption
     */
    public double getSum_total_energy_consumption() {
        return sum_total_energy_consumption;
    }

    /**
     * @param sum_total_energy_consumption the sum_total_energy_consumption to set
     */
    public void setSum_total_energy_consumption(double sum_total_energy_consumption) {
        this.sum_total_energy_consumption = checkfield(sum_total_energy_consumption);
    }

    /**
     * @return the sum_specific_power
     */
    public double getSum_specific_power() {
        return sum_specific_power;
    }

    /**
     * @param sum_specific_power the sum_specific_power to set
     */
    public void setSum_specific_power(double sum_specific_power) {
        this.sum_specific_power = checkfield(sum_specific_power);
    }

    /**
     * @return the sum_full_load_costs
     */
    public double getSum_full_load_costs() {
        return sum_full_load_costs;
    }

    /**
     * @param sum_full_load_costs the sum_full_load_costs to set
     */
    public void setSum_full_load_costs(double sum_full_load_costs) {
        this.sum_full_load_costs = checkfield(sum_full_load_costs);
    }

    /**
     * @return the sum_unload_costs
     */
    public double getSum_unload_costs() {
        return sum_unload_costs;
    }

    /**
     * @param sum_unload_costs the sum_unload_costs to set
     */
    public void setSum_unload_costs(double sum_unload_costs) {
        this.sum_unload_costs = checkfield(sum_unload_costs);
    }

    /**
     * @return the sum_stop_costs
     */
    public double getSum_stop_costs() {
        return sum_stop_costs;
    }

    /**
     * @param sum_stop_costs the sum_stop_costs to set
     */
    public void setSum_stop_costs(double sum_stop_costs) {
        this.sum_stop_costs = checkfield(sum_stop_costs);
    }

    /**
     * @return the sum_total_costs
     */
    public double getSum_total_costs() {
        return sum_total_costs;
    }

    /**
     * @param sum_total_costs the sum_total_costs to set
     */
    public void setSum_total_costs(double sum_total_costs) {
        this.sum_total_costs = checkfield(sum_total_costs);
    }

    /**
     * @return the sum_costs_per_m2
     */
    public double getSum_costs_per_m2() {
        return sum_costs_per_m2;
    }

    /**
     * @param sum_costs_per_m2 the sum_costs_per_m2 to set
     */
    public void setSum_costs_per_m2(double sum_costs_per_m2) {
        this.sum_costs_per_m2 = checkfield(sum_costs_per_m2);
    }

    /**
     * @return the sum_average_flow
     */
    public double getSum_average_flow() {
        return sum_average_flow;
    }

    /**
     * @param sum_average_flow the sum_average_flow to set
     */
    public void setSum_average_flow(double sum_average_flow) {
        this.sum_average_flow = checkfield(sum_average_flow);
    }

    /**
     * @return the sum_max_flow
     */
    public double getSum_max_flow() {
        return sum_max_flow;
    }

    /**
     * @param sum_max_flow the sum_max_flow to set
     */
    public void setSum_max_flow(double sum_max_flow) {
        this.sum_max_flow = checkfield(sum_max_flow);
    }

    /**
     * @return the sum_total_air_delivery
     */
    public double getSum_total_air_delivery() {
        return sum_total_air_delivery;
    }

    /**
     * @param sum_total_air_delivery the sum_total_air_delivery to set
     */
    public void setSum_total_air_delivery(double sum_total_air_delivery) {
        this.sum_total_air_delivery = checkfield(sum_total_air_delivery);
    }

    /**
     * @return the sum_average_leakage
     */
    public double getSum_average_leakage() {
        return sum_average_leakage;
    }

    /**
     * @param sum_average_leakage the sum_average_leakage to set
     */
    public void setSum_average_leakage(double sum_average_leakage) {
        this.sum_average_leakage = checkfield(sum_average_leakage);
    }

    /**
     * @return the sum_total_leakage
     */
    public double getSum_total_leakage() {
        return sum_total_leakage;
    }

    /**
     * @param sum_total_leakage the sum_total_leakage to set
     */
    public void setSum_total_leakage(double sum_total_leakage) {
        this.sum_total_leakage = checkfield(sum_total_leakage);
    }

    /**
     * @return the sum_leakage_costs
     */
    public double getSum_leakage_costs() {
        return sum_leakage_costs;
    }

    /**
     * @param sum_leakage_costs the sum_leakage_costs to set
     */
    public void setSum_leakage_costs(double sum_leakage_costs) {
        this.sum_leakage_costs = checkfield(sum_leakage_costs);
    }

    /**
     * @return the sum_co2_emission
     */
    public double getSum_co2_emission() {
        return sum_co2_emission;
    }

    /**
     * @param sum_co2_emission the sum_co2_emission to set
     */
    public void setSum_co2_emission(double sum_co2_emission) {
        this.sum_co2_emission = checkfield(sum_co2_emission);
    }

    /**
     * @return the sum_oneyear_full_load_time
     */
    public String getSum_oneyear_full_load_time() {
        return sum_oneyear_full_load_time;
    }

    /**
     * @param sum_oneyear_full_load_time the sum_oneyear_full_load_time to set
     */
    public void setSum_oneyear_full_load_time(String sum_oneyear_full_load_time) {
        this.sum_oneyear_full_load_time = sum_oneyear_full_load_time;
    }

    /**
     * @return the sum_oneyear_unload_time
     */
    public String getSum_oneyear_unload_time() {
        return sum_oneyear_unload_time;
    }

    /**
     * @param sum_oneyear_unload_time the sum_oneyear_unload_time to set
     */
    public void setSum_oneyear_unload_time(String sum_oneyear_unload_time) {
        this.sum_oneyear_unload_time = sum_oneyear_unload_time;
    }

    /**
     * @return the sum_oneyear_stop_time
     */
    public String getSum_oneyear_stop_time() {
        return sum_oneyear_stop_time;
    }

    /**
     * @param sum_oneyear_stop_time the sum_oneyear_stop_time to set
     */
    public void setSum_oneyear_stop_time(String sum_oneyear_stop_time) {
        this.sum_oneyear_stop_time = sum_oneyear_stop_time;
    }

    /**
     * @return the sum_oneyear_number_of_starts
     */
    public String getSum_oneyear_number_of_starts() {
        return sum_oneyear_number_of_starts;
    }

    /**
     * @param sum_oneyear_number_of_starts the sum_oneyear_number_of_starts to set
     */
    public void setSum_oneyear_number_of_starts(String sum_oneyear_number_of_starts) {
        this.sum_oneyear_number_of_starts = sum_oneyear_number_of_starts;
    }

    /**
     * @return the sum_oneyear_number_of_load_unload_cycles
     */
    public String getSum_oneyear_number_of_load_unload_cycles() {
        return sum_oneyear_number_of_load_unload_cycles;
    }

    /**
     * @param sum_oneyear_number_of_load_unload_cycles the sum_oneyear_number_of_load_unload_cycles to set
     */
    public void setSum_oneyear_number_of_load_unload_cycles(String sum_oneyear_number_of_load_unload_cycles) {
        this.sum_oneyear_number_of_load_unload_cycles = sum_oneyear_number_of_load_unload_cycles;
    }

    /**
     * @return the sum_oneyear_full_load_energy
     */
    public double getSum_oneyear_full_load_energy() {
        return sum_oneyear_full_load_energy;
    }

    /**
     * @param sum_oneyear_full_load_energy the sum_oneyear_full_load_energy to set
     */
    public void setSum_oneyear_full_load_energy(double sum_oneyear_full_load_energy) {
        if("NaN".equals(String.valueOf(sum_oneyear_full_load_energy)))sum_oneyear_full_load_energy = 0;
        this.sum_oneyear_full_load_energy = sum_oneyear_full_load_energy;
    }

    /**
     * @return the sum_oneyear_unload_energy
     */
    public double getSum_oneyear_unload_energy() {
        return sum_oneyear_unload_energy;
    }

    /**
     * @param sum_oneyear_unload_energy the sum_oneyear_unload_energy to set
     */
    public void setSum_oneyear_unload_energy(double sum_oneyear_unload_energy) {
        this.sum_oneyear_unload_energy = checkfield(sum_oneyear_unload_energy);
    }

    /**
     * @return the sum_oneyear_stop_energy
     */
    public double getSum_oneyear_stop_energy() {
        return sum_oneyear_stop_energy;
    }

    /**
     * @param sum_oneyear_stop_energy the sum_oneyear_stop_energy to set
     */
    public void setSum_oneyear_stop_energy(double sum_oneyear_stop_energy) {
        this.sum_oneyear_stop_energy = checkfield(sum_oneyear_stop_energy);
    }

    /**
     * @return the sum_oneyear_total_energy_consumption
     */
    public double getSum_oneyear_total_energy_consumption() {
        return sum_oneyear_total_energy_consumption;
    }

    /**
     * @param sum_oneyear_total_energy_consumption the sum_oneyear_total_energy_consumption to set
     */
    public void setSum_oneyear_total_energy_consumption(double sum_oneyear_total_energy_consumption) {
        if("NaN".equals(String.valueOf(sum_oneyear_total_energy_consumption)))sum_oneyear_total_energy_consumption = 0;
        this.sum_oneyear_total_energy_consumption = sum_oneyear_total_energy_consumption;
    }

    /**
     * @return the sum_oneyear_full_load_costs
     */
    public double getSum_oneyear_full_load_costs() {
        return sum_oneyear_full_load_costs;
    }

    /**
     * @param sum_oneyear_full_load_costs the sum_oneyear_full_load_costs to set
     */
    public void setSum_oneyear_full_load_costs(double sum_oneyear_full_load_costs) {
        this.sum_oneyear_full_load_costs = checkfield(sum_oneyear_full_load_costs);
    }

    /**
     * @return the sum_oneyear_unload_costs
     */
    public double getSum_oneyear_unload_costs() {
        return sum_oneyear_unload_costs;
    }

    /**
     * @param sum_oneyear_unload_costs the sum_oneyear_unload_costs to set
     */
    public void setSum_oneyear_unload_costs(double sum_oneyear_unload_costs) {
        this.sum_oneyear_unload_costs = checkfield(sum_oneyear_unload_costs);
    }

    /**
     * @return the sum_oneyear_stop_costs
     */
    public double getSum_oneyear_stop_costs() {
        return sum_oneyear_stop_costs;
    }

    /**
     * @param sum_oneyear_stop_costs the sum_oneyear_stop_costs to set
     */
    public void setSum_oneyear_stop_costs(double sum_oneyear_stop_costs) {
        this.sum_oneyear_stop_costs = checkfield(sum_oneyear_stop_costs);
    }

    /**
     * @return the sum_oneyear_total_costs
     */
    public double getSum_oneyear_total_costs() {
        return sum_oneyear_total_costs;
    }

    /**
     * @param sum_oneyear_total_costs the sum_oneyear_total_costs to set
     */
    public void setSum_oneyear_total_costs(double sum_oneyear_total_costs) {
        this.sum_oneyear_total_costs = checkfield(sum_oneyear_total_costs);
    }

    /**
     * @return the sum_oneyear_total_air_delivery
     */
    public double getSum_oneyear_total_air_delivery() {
        return sum_oneyear_total_air_delivery;
    }

    /**
     * @param sum_oneyear_total_air_delivery the sum_oneyear_total_air_delivery to set
     */
    public void setSum_oneyear_total_air_delivery(double sum_oneyear_total_air_delivery) {
        this.sum_oneyear_total_air_delivery = checkfield(sum_oneyear_total_air_delivery);
    }

    /**
     * @return the sum_oneyear_total_leakage
     */
    public double getSum_oneyear_total_leakage() {
        return sum_oneyear_total_leakage;
    }

    /**
     * @param sum_oneyear_total_leakage the sum_oneyear_total_leakage to set
     */
    public void setSum_oneyear_total_leakage(double sum_oneyear_total_leakage) {
        this.sum_oneyear_total_leakage = checkfield(sum_oneyear_total_leakage);
    }

    /**
     * @return the sum_oneyear_leakage_costs
     */
    public double getSum_oneyear_leakage_costs() {
        return sum_oneyear_leakage_costs;
    }

    /**
     * @param sum_oneyear_leakage_costs the sum_oneyear_leakage_costs to set
     */
    public void setSum_oneyear_leakage_costs(double sum_oneyear_leakage_costs) {
        this.sum_oneyear_leakage_costs = checkfield(sum_oneyear_leakage_costs);
    }

    /**
     * @return the sum_oneyear_co2_emission
     */
    public double getSum_oneyear_co2_emission() {
        return sum_oneyear_co2_emission;
    }

    /**
     * @param sum_oneyear_co2_emission the sum_oneyear_co2_emission to set
     */
    public void setSum_oneyear_co2_emission(double sum_oneyear_co2_emission) {

        this.sum_oneyear_co2_emission = checkfield(sum_oneyear_co2_emission);
    }

   
    private double checkfield(double field){
         if("NaN".equals(String.valueOf(field))){
             return 0;
         }else return field;
    }

    /**
     * @return the costs_unit
     */
    public String getCosts_unit() {
        return costs_unit;
    }

    /**
     * @param costs_unit the costs_unit to set
     */
    public void setCosts_unit(String costs_unit) {
        this.costs_unit = costs_unit;
    }

    /**
     * @return the specific_power_unit
     */
    public String getSpecific_power_unit() {
        return specific_power_unit;
    }

    /**
     * @param specific_power_unit the specific_power_unit to set
     */
    public void setSpecific_power_unit(String specific_power_unit) {
        this.specific_power_unit = specific_power_unit;
    }

    /**
     * @return the air_delivery_unit
     */
    public String getAir_delivery_unit() {
        return air_delivery_unit;
    }

    /**
     * @param air_delivery_unit the air_delivery_unit to set
     */
    public void setAir_delivery_unit(String air_delivery_unit) {
        this.air_delivery_unit = air_delivery_unit;
    }

    /**
     * @return the valid_record_time
     */
    public double getValid_record_time() {
        return valid_record_time;
    }

    /**
     * @param valid_record_time the valid_record_time to set
     */
    public void setValid_record_time(double valid_record_time) {
        this.valid_record_time = checkfield(valid_record_time);
    }

    /**
     * @return the sum_valid_record_time
     */
    public double getSum_valid_record_time() {
        return sum_valid_record_time;
    }

    /**
     * @param sum_valid_record_time the sum_valid_record_time to set
     */
    public void setSum_valid_record_time(double sum_valid_record_time) {
        this.sum_valid_record_time = sum_valid_record_time;
    }
    //==============================end


}
