package main.powercalc;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class DatabaseFileFInder {
	private String [] windFileFullArr_anu = new String[630];
	private String [] windFileFullArr_djf = new String[630];
	private String [] windFileFullArr_jja = new String[630];
	private String [] windFileFullArr_mam = new String[630];
	private String [] windFileFullArr_son = new String[630];
	private String [] SolardFileFullArr = new String[5];
	private String [] HydroFileFullArr = new String[6];
	private Double latitude1;
	private Double latitude2;
	private Double longitude1;
	private Double longitude2;
	private String returnWindFileListArray[] = new String[3150];
	private String returnSolarFileListArray[] = new String[1];
	private String returnHydroFileListArray[] = new String[2];
	private int counterWindfileFinder;
	private String pathWind;
	private String pathSolar;
	private String pathHydro;
	
	public DatabaseFileFInder() 
	{
		pathWind = "WEB-INF/Database/Wind/";
		pathSolar = "WEB-INF/Database/Solar/";
		pathHydro = "WEB-INF/Database/Hydro/";
		for(int i = 0; i < 21; i++) {
			for(int j = 0; j < 30; j++) {
				windFileFullArr_anu[i*30 + j] = String.valueOf(43+i) + "_" + String.valueOf(-135+j)
						+ "_" + String.valueOf(42+i) + "_" + String.valueOf(-136+j) + "_anu.json";
				windFileFullArr_djf[i*30 + j] = String.valueOf(43+i) + "_" + String.valueOf(-135+j)
						+ "_" + String.valueOf(42+i) + "_" + String.valueOf(-136+j) + "_djf.json";
				windFileFullArr_jja[i*30 + j] = String.valueOf(43+i) + "_" + String.valueOf(-135+j)
						+ "_" + String.valueOf(42+i) + "_" + String.valueOf(-136+j) + "_jja.json";
				windFileFullArr_mam[i*30 + j] = String.valueOf(43+i) + "_" + String.valueOf(-135+j)
						+ "_" + String.valueOf(42+i) + "_" + String.valueOf(-136+j) + "_mam.json";
				windFileFullArr_son[i*30 + j] = String.valueOf(43+i) + "_" + String.valueOf(-135+j)
						+ "_" + String.valueOf(42+i) + "_" + String.valueOf(-136+j) + "_son.json";
			}
		}
		
		SolardFileFullArr[0] = "Solar_anu.json";
		SolardFileFullArr[1] = "Solar_djf.json";
		SolardFileFullArr[2] = "Solar_mam.json";
		SolardFileFullArr[3] = "Solar_jja.json";
		SolardFileFullArr[4] = "Solar_son.json";
	    
	    HydroFileFullArr[0] = "Stream_1.json";
	    HydroFileFullArr[1] = "Hydro_anu.json";
	    HydroFileFullArr[2] = "Hydro_djf.json";
	    HydroFileFullArr[3] = "Hydro_mam.json";
	    HydroFileFullArr[4] = "Hydro_jja.json";
	    HydroFileFullArr[5] = "Hydro_son.json";
	}
	
    //supplied season name should be anu,djf,jja,son,mam
	public String[] windFileFinder(Double neLat, Double neLon, Double swLat, Double swLon, String season)
	{
		counterWindfileFinder = 0;
		String [] handler = null;
		switch(season) {
		case "anu": handler = windFileFullArr_anu; break;
		case "djf": handler = windFileFullArr_djf; break;
		case "jja": handler = windFileFullArr_jja; break;
		case "mam": handler = windFileFullArr_mam; break;
		case "son": handler = windFileFullArr_son; break;
		default: return null;
		}
		for(String item : handler)
		{
			Pattern boundaryP = Pattern.compile("^([-]?\\d+)_([-]?\\d+)_([-]?\\d+)_([-]?\\d+)_.*$");
			Matcher boundaryM = boundaryP.matcher(item);
			if (!boundaryM.matches()) {
				continue;
			} else {
				latitude1 = Double.parseDouble(boundaryM.group(1));
				latitude2 = Double.parseDouble(boundaryM.group(3));
				longitude1 = Double.parseDouble(boundaryM.group(2));
				longitude2 = Double.parseDouble(boundaryM.group(4));
			}
			//if one of the corner of requested grid falls inside our database grid
			if(((neLat>=latitude2&&neLat<=latitude1)||(swLat>=latitude2&&swLat<=latitude1))
					&& ((neLon<=longitude1&&neLon>=longitude2)||(swLon<=longitude1&&swLon>=longitude2)))
			{
				returnWindFileListArray[counterWindfileFinder]=pathWind+item;
				counterWindfileFinder++;
			}
			//if one of the corner of our database grid falls inside requested grid
			else if (((latitude1>=swLat&&latitude1<=neLat)||(latitude2>=swLat&&latitude2<=neLat))
					&& ((longitude1>=swLon&&longitude1<=neLon)||(longitude2>=swLon&&longitude2<=neLon)))
			{
				returnWindFileListArray[counterWindfileFinder]=pathWind+item;
				counterWindfileFinder++;
			}
			//if there is overlap of the database and requested grid, but no corners fall in the other
			else if (((latitude2<swLat && latitude1>neLat)&&(longitude2>swLon && longitude1<neLon))
					|| ((longitude2<swLon && longitude1>neLon)&&(latitude2>swLat && latitude1<neLat))) 
			{
				returnWindFileListArray[counterWindfileFinder]=pathWind+item;
				counterWindfileFinder++;
			}
			
		}
		return returnWindFileListArray;
	}
	public void displayWindReturnarr()
	{
	
		for(int counter = 0; returnWindFileListArray[counter]!=null; counter++)
		{
			System.out.println(returnWindFileListArray[counter]);
		}
	}
	//season name should be Jan, Feb ,etc..
	//I think we will later on try to squash solar data into spring, fall, winter, etc
	public String [] solarFileFinder(String Season)
	{	
		switch(Season)
		{	
			case "anu" : returnSolarFileListArray[0] = pathSolar+SolardFileFullArr[0];	break;
			case "djf" : returnSolarFileListArray[0] = pathSolar+SolardFileFullArr[1];	break;
			case "mam" : returnSolarFileListArray[0] = pathSolar+SolardFileFullArr[2];	break;
			case "jja" : returnSolarFileListArray[0] = pathSolar+SolardFileFullArr[3];	break;
			case "son" : returnSolarFileListArray[0] = pathSolar+SolardFileFullArr[4]; break;
		}
		return returnSolarFileListArray;
	}
	public void displaySolarFileList()
	{
		System.out.println(returnSolarFileListArray[0]);
	}
	
	public String [] hydroFileFinder(String Season, boolean getStreams)
	{
		int fileCounter = 0;
		if (getStreams) {
			returnHydroFileListArray[fileCounter] = pathHydro+HydroFileFullArr[0];
			fileCounter++;
		}
				
		switch(Season)
		{
			case "anu" : returnHydroFileListArray[fileCounter] = pathHydro+HydroFileFullArr[1]; break;
			case "djf" : returnHydroFileListArray[fileCounter] = pathHydro+HydroFileFullArr[2]; break;
			case "mam" : returnHydroFileListArray[fileCounter] = pathHydro+HydroFileFullArr[3]; break;
			case "jja" : returnHydroFileListArray[fileCounter] = pathHydro+HydroFileFullArr[4]; break;
			case "son" : returnHydroFileListArray[fileCounter] = pathHydro+HydroFileFullArr[5]; break;
		}
		return returnHydroFileListArray;
	}
	public void displayHydroFileList()
	{
		for(int counter = 0; counter < returnHydroFileListArray.length 
				&& returnHydroFileListArray[counter] != null; counter++)
		{
			System.out.println(returnHydroFileListArray[counter]);
		}
	}
}
