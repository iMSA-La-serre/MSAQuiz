export interface LicenseNotice {
  file: string
  text: string
  // True when the package ships no licence file and the text was rebuilt from
  // its declared licence (standard wording, author from package.json).
  generated?: boolean
}

// One open-source package shipped with the app, as listed on the licences
// page. Built at compile time by scripts/third-party-licenses.ts.
export interface ThirdPartyLicense {
  name: string
  version: string
  license: string
  repository: string | null
  notices: LicenseNotice[]
}
