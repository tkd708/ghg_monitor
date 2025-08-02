

dir_proj = getwd()
source(paste0(dir_proj, "/r_script/semiauto_ghg_process.R"))
source(paste0(dir_proj, "/r_script/functions_supporting.R"))
dir_semiauto_laser_crdc_n2o_eef_jdr_2025 = paste0(dir_proj, "/data/JDR_2025/")
dir_semiauto_laser_crdc_n2o_eef_jdr_2025 = paste0(dir_proj, "/data/cotton_test2/")
ls_semiauto_laser_files <- list.files(path = dir_semiauto_laser_crdc_n2o_eef_jdr_2025, pattern = "\\.csv$", full.names = TRUE)



# Process & check individually per file -----------------------------------------------------------------------

ls_files_i = ls_semiauto_laser_files[9]

df_i <- read_csv(ls_files_i,
                     col_types = cols(date = col_date(format = "%d/%m/%Y"))) %>%
  filter(!is.na(date), !is.na(`chamber id`)) %>%
  rename(site_id = `site id`,
         run_id = `run id`,
         chamber = `chamber id`,
         h2o_ppm=`h2o avg[ppm]`,
         co2_ppm=`co2[ppm]`,
         n2o_ppb=`n2o avg [ppb]`,
         #p_cavity_kpa=`pcavitytamb[kpa]`,
         #p_laser_kpa=`plaser[kpa]`
         # temp_laser =`tlaser[degC]`
  ) %>%
  mutate(chamber = paste0("C",sprintf("%02d", chamber)), # as.character(chamber)
         n2o_ppm = as.numeric(n2o_ppb)/1000,
         datetime = as.POSIXct(paste(date, time), format = "%Y-%m-%d %H:%M:%S")) %>%
  group_by(chamber) %>%
  mutate(time_elapsed = datetime - first(datetime))

df_i_label = df_i %>% group_by(chamber) %>% summarise(datetime=mean(datetime), h2o_ppm=mean(h2o_ppm), co2_ppm=mean(co2_ppm), n2o_ppm=mean(n2o_ppm))
ggplot(df_i) + geom_point(aes(x=datetime, y=co2_ppm, colour=chamber)) + geom_text(data=df_i_label, aes(x=datetime, y=min(co2_ppm)*0.98, label=chamber, colour=chamber), hjust = 0, vjust = 1)
ggplot(df_i) + geom_point(aes(x=datetime, y=n2o_ppm, colour=chamber)) + geom_text(data=df_i_label, aes(x=datetime, y=min(n2o_ppm)*0.98, label=chamber, colour=chamber), hjust = 0, vjust = 1)
ggplot(df_i) + geom_point(aes(x=datetime, y=h2o_ppm, colour=chamber)) + geom_text(data=df_i_label, aes(x=datetime, y=min(h2o_ppm)*0.95, label=chamber, colour=chamber), hjust = 0, vjust = 1)
ggplot(df_i) + geom_point(aes(x=time_elapsed, y=co2_ppm, colour=chamber)) 
ggplot(df_i) + geom_point(aes(x=time_elapsed, y=n2o_ppm, colour=chamber)) 
ggplot(df_i) + geom_point(aes(x=time_elapsed, y=h2o_ppm, colour=chamber))
  


### Quality control at individual data point level
df_i_fitlered = df_i %>%
  filter(#status==0,
         time_elapsed > 200,
         time_elapsed < 300
         #p_cavity_kpa > 35,
         #p_laser_kpa > 30
  ) %>%
  mutate(h2o_slope_ppm_sec = ifelse(sum(complete.cases(h2o_ppm, time_elapsed)) >= 2, coef(lm(h2o_ppm ~ time_elapsed))[2], NA),
         co2_slope_ppm_sec = ifelse(sum(complete.cases(co2_ppm, time_elapsed)) >= 2, coef(lm(co2_ppm ~ time_elapsed))[2], NA),
         co2_r2 = ifelse(sum(complete.cases(co2_ppm, time_elapsed)) >= 2, summary(lm(co2_ppm ~ time_elapsed))$r.squared, NA),
         n2o_slope_ppm_sec = ifelse(sum(complete.cases(n2o_ppm, time_elapsed)) >= 2, coef(lm(n2o_ppm ~ time_elapsed))[2], NA),
         n2o_r2 = ifelse(sum(complete.cases(n2o_ppm, time_elapsed)) >= 2, summary(lm(n2o_ppm ~ time_elapsed))$r.squared, NA)
  )

ggplot(df_i_fitlered, aes(x=time_elapsed, y=co2_ppm, color=chamber, fill=chamber)) + 
  geom_point() +
  geom_smooth(, method = "lm", se = TRUE) +
  stat_poly_eq(
    aes(label = paste("Chamber ", after_stat(group), ..eq.label.., ..rr.label.., sep = "~~~")),
    formula = y ~ x,
    parse = TRUE
  ) +
  scale_x_continuous(expand = c(0,0), limit=c(120, 300))
  

ggplot(df_i_fitlered, aes(x=time_elapsed, y=n2o_ppm, color=chamber, fill=chamber)) + 
  geom_point() +
  geom_smooth(, method = "lm", se = TRUE) +
  stat_poly_eq(
    aes(label = paste("Chamber ", after_stat(group), ..eq.label.., ..rr.label.., sep = "~~~")),
    formula = y ~ x,
    parse = TRUE
  ) +
  scale_x_continuous(expand = c(0,0), limit=c(120, 300))

#ggplot(df_i_fitlered) + geom_point(aes(x=time_elapsed, y=n2o_ppm, colour=chamber))


### Flux calc
df_i_flux = df_i_fitlered %>%
  group_by(chamber) %>%
  summarise(date = mean(date),
            datetime = mean(datetime),
            h2o_ppm_ave = mean(h2o_ppm, na.rm=T),
            co2_slope_ppm_sec = mean(co2_slope_ppm_sec),
            co2_r2 = mean(co2_r2),
            n2o_slope_ppm_sec = mean(n2o_slope_ppm_sec),
            n2o_r2 = mean(n2o_r2)) %>%
  mutate(head_space_m = 15/100,
         temp_ave = 25,
         mvor = 0.02241 * ((273.15+temp_ave)/273.15) * (101/101),
         n2o_ug_n_m2_h = n2o_slope_ppm_sec *head_space_m *28 *60*60 /mvor,
         n2o_g_n_ha_d = n2o_ug_n_m2_h * 0.24)

fn_semiauto_laser_csv_read_process(ls_semiauto_laser_files[9], time_head=200, time_tail=300) %>%
  data.frame() %>%
  mutate(chamber = paste0("C",sprintf("%02d", as.numeric(chamber)))) %>%
  arrange(chamber) %>%
  dplyr::select(datetime, chamber, co2_r2, co2_g_c_ha_d, n2o_r2, n2o_g_n_ha_d)
  
#####



# Process for the whole directory -----------------------------------------

df_semiauto_laser_flux_all = data.frame()
ls_semiauto_laser_csv_failed = c()
for(i in c(1:length(ls_semiauto_laser_files))){
  tryCatch({
    file_i = ls_semiauto_laser_files[i]
    message(paste0("Processing ", i, "th file: ", file_i))
    df_flux_i = fn_semiauto_laser_csv_read_process(file_i, time_head=200, time_tail=300) %>%
      mutate(hour_cycle = case_when(
        hour>=0 & hour<4 ~ "H0000",
        hour>=4 & hour<8 ~ "H0400",
        hour>=8 & hour<12 ~ "H0800",
        hour>=12 & hour<16 ~ "H1200",
        hour>=16 & hour<20 ~ "H1600",
        hour>=20 & hour<24 ~ "H2000"))
    df_semiauto_laser_flux_all = df_semiauto_laser_flux_all %>% rbind(df_flux_i) 
  }, error = function(e) {
    warning(paste("Failed to process:", file_i))
    ls_semiauto_laser_csv_failed = ls_semiauto_laser_csv_failed %>% append(file_i)
  })
}


### Flux value check
df_semiauto_laser_flux_all %>%
  data.frame() %>%
  filter(datetime > as.POSIXct("2025-07-29 12:00:00")) %>%
  dplyr::select(datetime, chamber_label, h2o_ppm_ave, co2_r2, co2_g_c_ha_d, n2o_r2, n2o_g_n_ha_d) %>%
  arrange(datetime, chamber_label) %>%
  View()




### Flux dynamics
ggplot(df_semiauto_laser_flux_all) + facet_grid(chamber_label~.) +
  geom_point(aes(x=datetime, y=co2_g_c_ha_d), size=0.5, alpha=0.5) +
  #scale_y_continuous(expand = c(0,0), limit=c(-100, 120)) +
  xlab("Date") +
  ylab("CO2 (gC/ha/d)")

ggplot(df_semiauto_laser_flux_all) + facet_grid(chamber_label~.) +
  geom_point(aes(x=datetime, y=n2o_g_n_ha_d), size=0.5, alpha=0.5) +
  #scale_y_continuous(expand = c(0,0), limit=c(-100, 120)) +
  xlab("Date") +
  ylab("N2O (gN/ha/d)")




### Diurnal pattern check

# H2O
ggplot(df_semiauto_laser_flux_all %>% filter(date >= as.Date("2025-07-30"), date <= as.Date("2025-07-31")), ) + 
  theme_classic() +
  geom_point(aes(x=hour_cycle, y=h2o_ppm_ave, colour=chamber_label)) +
  #scale_y_continuous(expand = c(0,0), limit=c(-1, 20)) +
  xlab("Hour") +
  ylab("H2O (ppm)")

ggplot(df_semiauto_laser_flux_all %>% filter(date >= as.Date("2025-07-30"), date <= as.Date("2025-07-31")), ) + 
  facet_grid(hour_cycle~.) +
  theme_classic() +
  geom_point(aes(x=chamber_label, y=h2o_ppm_ave, colour=chamber_label)) +
  #scale_y_continuous(expand = c(0,0), limit=c(-1, 20)) +
  xlab("Chamber") +
  ylab("H2O (ppm)")


# CO2
ggplot(df_semiauto_laser_flux_all) + 
  theme_classic() +
  geom_point(aes(x=hour_cycle, y=co2_g_c_ha_d, colour=chamber_label)) +
  #scale_y_continuous(expand = c(0,0), limit=c(-1, 20)) +
  xlab("Hour") +
  ylab("CO2 (gC/ha/d)")

ggplot(df_semiauto_laser_flux_all) + 
  theme_classic() +
  #geom_point(aes(x=hour, y=co2_r2, colour=chamber)) +
  geom_point(aes(x=hour_cycle, y=co2_r2, colour=co2_g_c_ha_d)) +
  scale_colour_gradientn(colours = terrain.colors(6)) +
  xlab("Hour") +
  ylab("CO2 R2")

ggplot(df_semiauto_laser_flux_all %>% filter(date >= as.Date("2025-07-25"))) + 
  theme_classic() +
  geom_point(aes(x=co2_g_c_ha_d, y=co2_r2, colour=chamber_label, shape=hour_cycle)) +
  xlab("CO2 (gC/ha/d)") +
  ylab("CO2 R2")

ggplot(df_semiauto_laser_flux_all %>% filter(date >= as.Date("2025-07-25"))) + 
  theme_classic() +
  geom_point(aes(x=chamber_label, y=co2_r2, colour=co2_g_c_ha_d, shape=hour_cycle)) +
  scale_colour_gradientn(colours = terrain.colors(6)) +
  xlab("Chamber") +
  ylab("CO2 R2")


# N2O
ggplot(df_semiauto_laser_flux_all) + 
  theme_classic() +
  geom_point(aes(x=hour_cycle, y=n2o_g_n_ha_d, colour=chamber_label)) +
  #scale_y_continuous(expand = c(0,0), limit=c(-1, 10)) +
  xlab("Hour") +
  ylab("N2O (gN/ha/d)")

ggplot(df_semiauto_laser_flux_all) + 
  theme_classic() +
  geom_point(aes(x=hour_cycle, y=n2o_r2, colour=chamber_label)) +
  xlab("Hour") +
  ylab("N2O R2")

ggplot(df_semiauto_laser_flux_all %>% filter(date >= as.Date("2025-07-25"))) + 
  theme_classic() +
  geom_point(aes(x=n2o_g_n_ha_d, y=n2o_r2, colour=chamber_label, shape=hour_cycle)) +
  scale_x_continuous(expand = c(0,0), limit=c(-3, 30)) +
  xlab("N2O (gN/ha/d)") +
  ylab("N2O R2")

ggplot(df_semiauto_laser_flux_all %>% filter(date >= as.Date("2025-07-25"))) + 
  theme_classic() +
  geom_point(aes(x=chamber_label, y=n2o_r2, colour=n2o_g_n_ha_d, shape=hour_cycle)) +
  scale_colour_gradientn(colours = terrain.colors(6)) +
  #scale_colour_gradient2(low = "green4", mid = "orange", high = "red", midpoint = 10) +
  xlab("Chamber") +
  ylab("N2O R2")


### Quality control at the sampling event level

# Filtered flux data
df_semiauto_laser_flux_filtered = 
  df_semiauto_laser_flux_all %>%
  filter(date >= as.Date("2025-07-16")) %>%
  #filter(date >= as.Date("2025-07-25")) %>%
  filter(co2_r2 >= 0.6) %>%
  #filter(n2o_r2 >= 0.6, n2o_g_n_ha_d >= -5) %>%
  data.frame()

message(nrow(df_semiauto_laser_flux_filtered)/nrow(df_semiauto_laser_flux_all)*100, "% flux remained after filtering")

df_semiauto_laser_flux_filtered %>% group_by(chamber) %>% summarise(n=n())
df_semiauto_laser_flux_filtered %>% group_by(chamber, date) %>% summarise(n=n()) %>% data.frame()

# Likely sampling failure
df_flux_low_co2_r2 = 
  df_semiauto_laser_flux_all %>%
  filter(co2_r2 < 0.7)

message(nrow(df_flux_low_co2_r2)/nrow(df_semiauto_laser_flux_all)*100, "% flux discarded due to invaild CO2")

df_semiauto_laser_flux_strict_n2o = 
  df_semiauto_laser_flux_all %>%
  filter(co2_r2 >= 0.7) %>%
  filter(n2o_r2 >= 0.6, n2o_g_n_ha_d >= -5) %>%
  data.frame()

message(nrow(df_semiauto_laser_flux_strict_n2o)/nrow(df_semiauto_laser_flux_all)*100, "% flux remained after filtering")

# Just N2O not stable enough
df_flux_low_n2o_r2 = 
  df_semiauto_laser_flux_all %>%
  filter(co2_r2 >= 0.7, n2o_r2 < 0.6)

message(nrow(df_flux_low_n2o_r2)/nrow(df_semiauto_laser_flux_all)*100, "% of N2O fluxes showed low R2 with valid CO2")

# Negative N2O
df_flux_negative_n2o = 
  df_semiauto_laser_flux_all %>% 
  filter(co2_r2 >= 0.7, n2o_r2 >= 0.6 & n2o_g_n_ha_d < -5)

message(nrow(df_flux_negative_n2o)/nrow(df_semiauto_laser_flux_all)*100, "% of N2O fluxes were negative with valid CO2")




ggplot(df_semiauto_laser_flux_filtered) + facet_grid(chamber_label~.) +
  geom_point(aes(x=datetime, y=co2_g_c_ha_d), size=0.5, alpha=0.5) +
  #geom_line(aes(x=datetime, y=n2o_g_n_ha_d)) +
  #scale_y_continuous(expand = c(0,0), limit=c(-5, 120)) +
  xlab("Date") +
  ylab("CO2 (gC/ha/d)")

ggplot(df_semiauto_laser_flux_filtered) + facet_grid(chamber_label~.) +
  geom_point(aes(x=datetime, y=n2o_g_n_ha_d), size=0.5, alpha=0.5) +
  #geom_line(aes(x=datetime, y=n2o_g_n_ha_d)) +
  scale_y_continuous(expand = c(0,0), limit=c(-5, 120)) +
  xlab("Date") +
  ylab("N2O (gN/ha/d)")

# write.csv(df_semiauto_laser_flux_filtered, paste0(dir_semiauto_laser, "df_semiauto_laser_flux_filtered.csv"), row.names = FALSE)

#####



# Process with the experimental meta data --------------------------------------
df_plot = data.frame(
  chamber = c(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16),
  plot = c(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16),
  nrate = c(0, 200, 200, 200, 0, 200, 200, 200, 0, 200, 200, 200, 0, 200, 200, 200),
  treatment = c("N0", "eNPower", "N200", "Centuro", "N0", "eNPower", "N200", "Centuro", 
                "N0", "eNPower", "N200", "Centuro", "N0", "eNPower", "N200", "Centuro"),
  rep = c(1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4)
  ) %>%
  mutate(treatment=factor(treatment, levels=c("N0", "N200", "Centuro", "eNPower")))

df_semiauto_laser_flux_filtered_plot =
  df_semiauto_laser_flux_filtered %>% 
  merge(df_plot, by=c("chamber"))


df_semiauto_laser_flux_filtered_plot %>% group_by(treatment, date) %>% summarise(n=n()) %>% data.frame()


ggplot(df_semiauto_laser_flux_filtered_plot) + 
  theme_classic() +
  facet_grid(treatment~.) +
  geom_point(aes(x=date, y=co2_g_c_ha_d, colour=chamber_label)) +
  #scale_y_continuous(expand = c(0,0), limit=c(-1, 10)) +
  xlab("Date") +
  ylab("CO2 (gC/ha/d)")

ggplot(df_semiauto_laser_flux_filtered_plot) + 
  theme_classic() +
  facet_grid(treatment~.) +
  geom_point(aes(x=date, y=n2o_g_n_ha_d, colour=chamber_label), alpha=0.5) +
  #scale_y_continuous(expand = c(0,0), limit=c(-5, 30)) +
  xlab("Date") +
  ylab("N2O (gN/ha/d)")




### Treatment average subdaily
df_semiauto_laser_flux_filtered_plot_subdaily_ave =
  df_semiauto_laser_flux_filtered_plot %>%
  group_by(date, run_id, datetime_cycle_start, treatment, nrate) %>%
  summarise(co2_g_c_ha_d_mean = mean(co2_g_c_ha_d, na.rm=T),
            co2_g_c_ha_d_sd = sd(co2_g_c_ha_d, na.rm=T),
            co2_g_c_ha_d_se = co2_g_c_ha_d_sd/sqrt(n()),
            co2_g_c_ha_d_cv = co2_g_c_ha_d_sd/co2_g_c_ha_d_mean,
            n2o_g_n_ha_d_mean = mean(n2o_g_n_ha_d, na.rm=T),
            n2o_g_n_ha_d_sd = sd(n2o_g_n_ha_d, na.rm=T),
            n2o_g_n_ha_d_se = n2o_g_n_ha_d_sd/sqrt(n()),
            n2o_g_n_ha_d_cv = n2o_g_n_ha_d_sd/n2o_g_n_ha_d_mean)
  

ggplot(df_semiauto_laser_flux_filtered_plot_subdaily_ave) + 
  theme_classic() +
  #facet_grid(treatment~.) +
  geom_line(aes(x=datetime_cycle_start, y=co2_g_c_ha_d_mean, colour=treatment), size=0.5, alpha=0.3) +
  geom_errorbar(aes(x=datetime_cycle_start, ymin=co2_g_c_ha_d_mean-co2_g_c_ha_d_se, ymax=co2_g_c_ha_d_mean+co2_g_c_ha_d_se, colour=treatment), size=0.5, alpha=0.3) +
  geom_point(aes(x=datetime_cycle_start, y=co2_g_c_ha_d_mean, colour=treatment), size=1.5, alpha=1) +
  #scale_y_continuous(expand = c(0,0), limit=c(-1, 10)) +
  xlab("Date") +
  ylab("CO2 (gC/ha/d)")

ggplot(df_semiauto_laser_flux_filtered_plot_subdaily_ave) + 
  theme_classic() +
  #facet_grid(treatment~.) +
  geom_line(aes(x=datetime_cycle_start, y=n2o_g_n_ha_d_mean, colour=treatment), size=0.5, alpha=0.3) +
  geom_errorbar(aes(x=datetime_cycle_start, ymin=n2o_g_n_ha_d_mean-n2o_g_n_ha_d_se, ymax=n2o_g_n_ha_d_mean+n2o_g_n_ha_d_se, colour=treatment), size=0.5, alpha=0.3) +
  geom_point(aes(x=datetime_cycle_start, y=n2o_g_n_ha_d_mean, colour=treatment), size=1.5, alpha=1) +
  #scale_y_continuous(expand = c(0,0), limit=c(-1, 10)) +
  xlab("Date") +
  ylab("N2O (gN/ha/d)")






### Conversion to daily fluxes
df_semiauto_laser_flux_filtered_plot_daily =
  df_semiauto_laser_flux_filtered_plot %>%
  group_by(date, treatment, nrate, chamber) %>%
  summarise(co2_g_c_ha_d = mean(co2_g_c_ha_d, na.rm=T),
            n2o_g_n_ha_d = mean(n2o_g_n_ha_d, na.rm=T))

df_plot_blank =
  expand.grid(chamber = df_semiauto_laser_flux_filtered_plot_daily$chamber %>% unique(),
              date = seq.Date(from=as.Date("2025-07-15"), to=df_semiauto_laser_flux_filtered_plot_daily$date%>%max(), by=1)
              )

df_semiauto_laser_flux_filtered_plot_daily_cumsum =
  df_plot_blank %>%
  merge(df_plot, by=c("chamber")) %>%
  merge(df_semiauto_laser_flux_filtered_plot_daily, by=c("date", "chamber", "treatment", "nrate"), all=T) %>%
  # df_n2o_flux_all_filtered_plot_daily %>%
  # filter(date > as.Date("2025-03-01")) %>% # only from LICOR measurements
  group_by(treatment, nrate, chamber) %>%
  mutate(n2o_gf = safe_linear_gf(n2o_g_n_ha_d),
         #n2o_cumsum = cumsum(ifelse(is.na(n2o_g_n_ha_d), 0, n2o_g_n_ha_d)),
         n2o_cumsum = cumsum(n2o_gf)
  )

ggplot(df_semiauto_laser_flux_filtered_plot_daily) + 
  theme_classic() +
  facet_grid(treatment~.) +
  geom_point(aes(x=date, y=co2_g_c_ha_d, colour=chamber), size=1, alpha=1) +
  #scale_y_continuous(expand = c(0,0), limit=c(-1, 15)) +
  xlab("Date") +
  ylab("CO2 (gC/ha/d)")

ggplot(df_semiauto_laser_flux_filtered_plot_daily) + 
  theme_classic() +
  facet_grid(treatment~.) +
  geom_point(aes(x=date, y=n2o_g_n_ha_d, colour=chamber), size=1, alpha=1) +
  scale_y_continuous(expand = c(0,0), limit=c(-1, 15)) +
  xlab("Date") +
  ylab("N2O (gN/ha/d)")

ggplot(df_semiauto_laser_flux_filtered_plot_daily_cumsum) + 
  theme_classic() +
  facet_grid(treatment~.) +
  geom_line(aes(x=date, y=n2o_cumsum, colour=chamber), size=1, alpha=1) +
  #scale_y_continuous(expand = c(0,0), limit=c(-5, 120)) +
  xlab("Date") +
  ylab("Cumulative N2O (gN/ha)")

# write.csv(df_semiauto_laser_flux_filtered_plot_daily_cumsum, paste0(dir_semiauto_laser, "df_semiauto_laser_flux_filtered_plot_daily_cumsum.csv"), row.names = FALSE)


### Averaged per treatment
df_semiauto_laser_flux_filtered_plot_daily_cumsum_ave =
  df_semiauto_laser_flux_filtered_plot_daily_cumsum %>%
  group_by(date, treatment, nrate) %>%
  summarise(n2o_g_n_ha_d_mean = mean(n2o_g_n_ha_d, na.rm=T),
            n2o_g_n_ha_d_se = sd(n2o_g_n_ha_d, na.rm=T)/sqrt(n()),
            n2o_cumsum_mean = mean(n2o_cumsum, na.rm=T),
            n2o_cumsum_se = sd(n2o_cumsum, na.rm=T)/sqrt(n())
            )


ggplot(df_semiauto_laser_flux_filtered_plot_daily_cumsum_ave) + 
  theme_classic() +
  geom_ribbon(aes(x=date, ymin=n2o_g_n_ha_d_mean-n2o_g_n_ha_d_se, ymax=n2o_g_n_ha_d_mean+n2o_g_n_ha_d_se, fill=treatment), alpha=0.5) +
  geom_line(aes(x=date, y=n2o_g_n_ha_d_mean, colour=treatment)) +
  #scale_y_continuous(expand = c(0,0), limit=c(-5, 150)) +
  xlab("Date") +
  ylab("N2O (gN/ha/d)")

ggplot(df_semiauto_laser_flux_filtered_plot_daily_cumsum_ave) + 
  theme_classic() +
  geom_ribbon(aes(x=date, ymin=n2o_cumsum_mean-n2o_cumsum_se, ymax=n2o_cumsum_mean+n2o_cumsum_se, fill=treatment), alpha=0.5) +
  geom_line(aes(x=date, y=n2o_cumsum_mean, colour=treatment)) +
  # scale_y_continuous(expand = c(0,0), limit=c(-100, 350)) +
  xlab("Date") +
  ylab("Cumulative N2O (gN/ha)")

# write.csv(df_semiauto_laser_flux_filtered_plot_daily_cumsum_ave, paste0(dir_semiauto_laser, "df_semiauto_laser_flux_filtered_plot_daily_cumsum_ave.csv"), row.names = FALSE)


#####

