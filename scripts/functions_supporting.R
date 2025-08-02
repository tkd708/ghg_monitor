
r2 = function(a,b) {
  if (length(a[!is.na(a)])==0|length(b[!is.na(b)])==0) {return(NA)} 
  #rss <- sum((b - a) ^ 2)  ## residual sum of squares
  #tss <- sum((a - mean(a, na.rm=T)) ^ 2)  ## total sum of squares
  #rsq <- 1 - rss/tss
  rsq = summary(lm(a ~ b))$r.squared 
  
  return(rsq)
}

mae<- function(a, b) {
  return(sum(abs(a - b)) / length(a))
}

rmsd <- function(a, b) {
  e2<-(a - b) * (a - b)
  rmsdv <- sqrt(sum(e2)/length(e2))
  return(rmsdv)
}

RMSE <- function(a, b) {
  RMSE <- sqrt(mean((a-b)^2, na.rm=T))
  return(RMSE)
}

#obs >> a
RMSEn <- function(a, b) {
  RMSE <- sqrt(mean((a-b)^2, na.rm=T))
  RMSEn <- RMSE/ mean(a, na.rm=T) *100
  return(RMSEn)
}

# to avoid "! At least 2 non-NA data points required in the time series to apply na_interpolation."
safe_linear_gf <- function(x) {
  # try linear interpolation
  tryCatch({
    na_interpolation(ifelse(is.nan(x), NA, x), option="linear")
  }, # last observation carried forward
  error = function(e1){
    tryCatch({
      na_locf(x, option = "locf", na_remaining = "rev") 
      
    }, # Final fallback to original vector
    error = function(e2) {
      x
    })
  })
}
