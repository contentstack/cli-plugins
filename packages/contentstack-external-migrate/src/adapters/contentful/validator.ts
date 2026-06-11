import jsonConfig from './contentful-schema.json';
import { parseJsonLoose } from '../../lib/parse-json-loose';

//interface for json file data
interface JsonData {
  [key: string]: any;
}

//function to validate json file data
function contentfulValidator(data: string): boolean {
  let jsonData: JsonData;

  try {
    //parse the data (tolerant — BOM/control-char/trailing-comma recovery)
    jsonData = parseJsonLoose(data);

    //iterate through jsonconfig to check to check if data is valid
    return Object.values(jsonConfig).every((prop:any) => {
      // Check if the current property exists in the json data.
      if (jsonData?.hasOwnProperty(prop?.name)) {
        return true;
      }
      // If the property is required but not present
      else if (prop?.required === 'true') {
        return false;
      }
      return true;
    });
  } catch (error) {
    //console.error('Error:', error);
    return false;
  }
}
export default contentfulValidator;
