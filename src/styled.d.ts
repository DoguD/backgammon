import 'styled-components'

declare module 'styled-components' {
  export interface DefaultTheme {
    borderRadius: string

    colors: {
      green: string,
      highlight: string,
      darkBrown: string,
      lightBrown: string,
      redPiece1: string,
      redPiece2: string,
      greenPiece1: string,
      greenPiece2: string,
      white: string,
      grey: string,
      black: string,
    }
  }
}
