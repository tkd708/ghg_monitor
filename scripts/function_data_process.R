
### Libraries

# data wrangling
library(readr)
library(dplyr)
library(tibble)
library(tidyr)
library(lubridate)
library(zoo)
library(imputeTS)

# plotting
library(ggplot2)
library(gridExtra)
library(grid)
library(cowplot)
library(ggpmisc)


### Flux calc function per file
fn_semiauto_laser_csv_read_process = function(file_i, time_head, time_tail){
  df_i <- read_csv(file_i,
                   col_types = cols(date = col_date(format = "%d/%m/%Y"))) %>%
    filter(!is.na(date)) %>%
    rename(site_id = `site id`,
           run_id = `run id`,
           chamber = `chamber id`,
           h2o_ppm=`h2o avg[ppm]`,
           co2_ppm=`co2[ppm]`,
           n2o_ppb=`n2o avg [ppb]`
    ) %>%
    mutate(chamber = as.character(chamber),
           n2o_ppm = as.numeric(n2o_ppb)/1000,
           datetime = as.POSIXct(paste(date, time), format = "%Y-%m-%d %H:%M:%S")) %>%
    group_by(chamber) %>%
    mutate(time_elapsed = datetime - first(datetime))
  
  df_i_fitlered = df_i %>%
    filter(#status==0,
      time_elapsed > time_head,
      time_elapsed < time_tail
    ) %>%
    # slope and r2 calc per group (i.e. chamber)
    mutate(h2o_slope_ppm_sec = ifelse(sum(complete.cases(h2o_ppm, time_elapsed)) >= 2, coef(lm(h2o_ppm ~ time_elapsed))[2], NA),
           co2_slope_ppm_sec = ifelse(sum(complete.cases(co2_ppm, time_elapsed)) >= 2, coef(lm(co2_ppm ~ time_elapsed))[2], NA),
           n2o_slope_ppm_sec = ifelse(sum(complete.cases(n2o_ppm, time_elapsed)) >= 2, coef(lm(n2o_ppm ~ time_elapsed))[2], NA),
           co2_r2 = ifelse(sum(complete.cases(co2_ppm, time_elapsed)) >= 2, summary(lm(co2_ppm ~ time_elapsed))$r.squared, NA),
           n2o_r2 = ifelse(sum(complete.cases(n2o_ppm, time_elapsed)) >= 2, summary(lm(n2o_ppm ~ time_elapsed))$r.squared, NA)
    )
  
  df_i_flux = df_i_fitlered %>%
    group_by(run_id, chamber) %>%
    summarise(date = mean(date, na.rm=T),
              datetime = min(datetime, na.rm=T), # min or mean
              h2o_ppm_ave = mean(h2o_ppm, na.rm=T),
              h2o_slope_ppm_sec = mean(h2o_slope_ppm_sec, na.rm=T),
              co2_slope_ppm_sec = mean(co2_slope_ppm_sec, na.rm=T),
              n2o_slope_ppm_sec = mean(n2o_slope_ppm_sec, na.rm=T),
              co2_r2 = mean(co2_r2, na.rm=T),
              n2o_r2 = mean(n2o_r2, na.rm=T)) %>%
    mutate(chamber_label = paste0("C",sprintf("%02d", as.numeric(chamber))),
           head_space_m = 15/100,
           temp_ave = 25, # to be updated
           mvor = 0.02241 * ((273.15+temp_ave)/273.15) * (101/101),
           time_conversion_to_hour = 60 * 60,
           co2_ug_c_m2_h = co2_slope_ppm_sec *head_space_m *12 /mvor *time_conversion_to_hour,
           n2o_ug_n_m2_h = n2o_slope_ppm_sec *head_space_m *28 /mvor *time_conversion_to_hour,
           co2_g_c_ha_d = co2_ug_c_m2_h * 0.24,
           n2o_g_n_ha_d = n2o_ug_n_m2_h * 0.24,
           file = file_i,
           datetime_cycle_start = min(datetime),
           hour = hour(datetime)
    )
  
  return(df_i_flux)
}


# OLD - the files were mixed with AERIS and different output formats
fn_n2o_csv_read_process_cortiva = function(file_i){
  df_n2o_i <- read_csv(file_i,
                       col_types = cols(date = col_date(format = "%d/%m/%Y"))) %>%
    filter(!is.na(date)) %>%
    rename(n2o_ppb=`n2o avg [ppm]` # ppb actually
    ) %>%
    mutate(chamber = as.character(chamber),
           n2o_ppm = as.numeric(n2o_ppb)/1000,
           datetime = as.POSIXct(paste(date, time), format = "%Y-%m-%d %H:%M:%S")) %>%
    group_by(chamber) %>%
    mutate(time_elapsed = datetime - first(datetime))
  
  df_n2o_i_fitlered = df_n2o_i %>%
    filter(time_elapsed > 240,
           time_elapsed < 570
    ) %>%
    mutate(n2o_slope_ppm_sec = ifelse(sum(complete.cases(n2o_ppm, time_elapsed)) >= 2, coef(lm(n2o_ppm ~ time_elapsed))[2], NA),
           n2o_r2 = ifelse(sum(complete.cases(n2o_ppm, time_elapsed)) >= 2, summary(lm(n2o_ppm ~ time_elapsed))$r.squared, NA)
    )
  
  df_n2o_i_flux = df_n2o_i_fitlered %>%
    # dplyr::select(date, datetime, chamber, n2o_slope_ppm_sec, n2o_r2) %>%
    # unique() %>%
    group_by(chamber) %>%
    summarise(date = mean(date, na.rm=T),
              datetime = mean(datetime, na.rm=T),
              n2o_slope_ppm_sec = mean(n2o_slope_ppm_sec, na.rm=T),
              n2o_r2 = mean(n2o_r2, na.rm=T)) %>%
    mutate(head_space_m = 15/100,
           temp_ave = 25, # to be updated
           mvor = 0.02241 * ((273.15+temp_ave)/273.15) * (101/101),
           n2o_ug_n_m2_h = n2o_slope_ppm_sec *head_space_m *28 *60*60 /mvor,
           n2o_g_n_ha_d = n2o_ug_n_m2_h * 0.24,
           file = file_i)
  
  return(df_n2o_i_flux)
}

